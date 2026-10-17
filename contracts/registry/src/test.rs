#![cfg(test)]

extern crate std;

use super::{DataKey, Registration, UserRegistry, UserRegistryClient};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{
        storage::{Instance as _, Persistent as _},
        Address as _, Events as _, Ledger, MockAuth, MockAuthInvoke,
    },
    Address, Env, IntoVal, Symbol, TryIntoVal, Val, Vec,
};

#[contract]
struct ContractCaller;

#[contractimpl]
impl ContractCaller {
    pub fn register_as_contract(env: Env, registry: Address) -> Registration {
        let caller = env.current_contract_address();
        caller.require_auth();
        UserRegistryClient::new(&env, &registry).register(&caller)
    }
}

fn setup() -> (Env, Address, UserRegistryClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger()
        .with_mut(|ledger| ledger.timestamp = 1_700_000_000);
    let registry_id = env.register(UserRegistry, ());
    let client = UserRegistryClient::new(&env, &registry_id);
    (env, registry_id, client)
}

fn registration_events(env: &Env, contract_id: &Address) -> std::vec::Vec<(Vec<Val>, Val)> {
    env.events()
        .all()
        .iter()
        .filter_map(|(emitter, topics, data)| {
            if &emitter != contract_id {
                return None;
            }
            let registry_topic: Symbol = topics.get(0)?.try_into_val(env).ok()?;
            let version_topic: Symbol = topics.get(1)?.try_into_val(env).ok()?;
            if registry_topic != Symbol::new(env, "registry")
                || version_topic != Symbol::new(env, "registered_v1")
            {
                return None;
            }
            Some((topics, data))
        })
        .collect()
}

#[test]
fn first_registration_stores_address_timestamp_and_one_v1_event() {
    let (env, registry_id, client) = setup();
    let user = Address::generate(&env);

    let registration = client.register(&user);
    let events = registration_events(&env, &registry_id);

    assert_eq!(registration.address, user);
    assert_eq!(registration.registered_at, 1_700_000_000);
    assert_eq!(events.len(), 1);
    let (topics, data) = events
        .into_iter()
        .next()
        .expect("registration event should be present");
    let event_address: Address = topics
        .get(2)
        .expect("wallet topic should be present")
        .try_into_val(&env)
        .expect("wallet topic should be an address");
    let registered_at: u64 = data.try_into_val(&env).expect("timestamp should be u64");
    assert_eq!(event_address, user);
    assert_eq!(registered_at, 1_700_000_000);
    assert_eq!(client.get_registration(&user), Some(registration));
    assert!(client.is_registered(&user));
}

#[test]
fn duplicate_registration_requires_auth_and_preserves_original_record_and_event() {
    let (env, registry_id, client) = setup();
    let user = Address::generate(&env);
    let original = client.register(&user);
    assert_eq!(registration_events(&env, &registry_id).len(), 1);
    env.ledger()
        .with_mut(|ledger| ledger.timestamp = 1_800_000_000);

    let duplicate = client.register(&user);
    assert_eq!(registration_events(&env, &registry_id).len(), 0);

    assert_eq!(duplicate, original);
    assert_eq!(client.get_registration(&user), Some(original));
}

#[test]
fn registrations_are_distinct_per_user_and_missing_records_are_empty() {
    let (env, _, client) = setup();
    let first = Address::generate(&env);
    let second = Address::generate(&env);
    let absent = Address::generate(&env);

    assert_eq!(client.get_registration(&absent), None);
    assert!(!client.is_registered(&absent));
    let first_record = client.register(&first);
    env.ledger().with_mut(|ledger| ledger.timestamp += 1);
    let second_record = client.register(&second);

    assert_ne!(first_record.address, second_record.address);
    assert_ne!(first_record.registered_at, second_record.registered_at);
    assert_eq!(client.get_registration(&first), Some(first_record));
    assert_eq!(client.get_registration(&second), Some(second_record));
}

#[test]
fn registration_rejects_missing_and_wrong_user_authorization() {
    let (env, registry_id, client) = setup();
    let authorized_user = Address::generate(&env);
    let other_user = Address::generate(&env);

    let missing_auth = client.mock_auths(&[]).try_register(&authorized_user);
    assert!(missing_auth.is_err());

    let invocation_args = (authorized_user.clone(),).into_val(&env);
    env.mock_auths(&[MockAuth {
        address: &authorized_user,
        invoke: &MockAuthInvoke {
            contract: &registry_id,
            fn_name: "register",
            args: invocation_args,
            sub_invokes: &[],
        },
    }]);
    let wrong_user_auth = client.try_register(&other_user);
    assert!(wrong_user_auth.is_err());
    env.mock_all_auths();

    assert_eq!(client.get_registration(&authorized_user), None);
    assert_eq!(client.get_registration(&other_user), None);
    assert_eq!(env.events().all().len(), 0);
}

#[test]
fn contract_account_address_can_authorize_registration_as_invoker() {
    let (env, registry_id, _) = setup();
    let caller_id = env.register(ContractCaller, ());
    let caller = ContractCallerClient::new(&env, &caller_id);

    let registration = caller.register_as_contract(&registry_id);

    assert_eq!(registration.address, caller_id);
    assert_eq!(
        UserRegistryClient::new(&env, &registry_id).get_registration(&caller_id),
        Some(registration)
    );
}

#[test]
fn registration_and_instance_ttls_are_extended_when_used() {
    let (env, registry_id, client) = setup();
    let user = Address::generate(&env);
    client.register(&user);

    let (instance_ttl, registration_ttl) = env.as_contract(&registry_id, || {
        (
            env.storage().instance().get_ttl(),
            env.storage()
                .persistent()
                .get_ttl(&DataKey::Registration(user.clone())),
        )
    });
    let current_sequence = env.ledger().get().sequence_number;
    env.ledger().with_mut(|ledger| {
        ledger.sequence_number = current_sequence + instance_ttl.min(registration_ttl) - 50;
    });

    assert!(client.is_registered(&user));

    let (extended_instance_ttl, extended_registration_ttl) = env.as_contract(&registry_id, || {
        (
            env.storage().instance().get_ttl(),
            env.storage()
                .persistent()
                .get_ttl(&DataKey::Registration(user.clone())),
        )
    });
    assert!(extended_instance_ttl > instance_ttl.min(registration_ttl) - 50);
    assert!(extended_registration_ttl > registration_ttl.min(instance_ttl) - 50);
}
