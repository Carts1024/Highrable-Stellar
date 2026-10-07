#![cfg(test)]

extern crate std;

use super::{
    DisputeMarkedEvent, DisputeResolvedEvent, Error, EscrowContract, EscrowContractClient, TEscrow,
    TEscrowStatus,
};
use highrable_reputation::{
    ReputationContract, ReputationContractClient, TCompletionRecord, TFreelancerStatsView,
};
use soroban_sdk::xdr::{
    Limits, ReadXdr, ScSpecEntry, ScSpecTypeBytesN, ScSpecTypeDef, ScSpecTypeResult,
    ScSpecTypeTuple,
};
use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{
        Address as _, AuthorizedFunction, AuthorizedInvocation, Events as _, Ledger, MockAuth,
        MockAuthInvoke,
    },
    token, Address, BytesN, Env, IntoVal, InvokeError, Map, Symbol, TryIntoVal, Val, Vec,
};
use std::boxed::Box;
use std::string::ToString;

#[derive(Clone)]
#[contracttype]
enum FailingTokenKey {
    Balance(Address),
    FailRecipient,
}

#[contract]
struct FailingToken;

#[contractimpl]
impl FailingToken {
    pub fn balance(env: Env, owner: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&FailingTokenKey::Balance(owner))
            .unwrap_or(0)
    }

    pub fn mint(env: Env, owner: Address, amount: i128) {
        let key = FailingTokenKey::Balance(owner);
        let balance = env.storage().persistent().get(&key).unwrap_or(0i128);
        env.storage().persistent().set(&key, &(balance + amount));
    }

    pub fn fail_for_recipient(env: Env, recipient: Address) {
        env.storage()
            .instance()
            .set(&FailingTokenKey::FailRecipient, &recipient);
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        let fail_recipient: Option<Address> = env
            .storage()
            .instance()
            .get(&FailingTokenKey::FailRecipient);
        if fail_recipient.as_ref() == Some(&to) {
            panic!("configured recipient transfer failure");
        }

        let from_key = FailingTokenKey::Balance(from);
        let to_key = FailingTokenKey::Balance(to);
        let from_balance = env.storage().persistent().get(&from_key).unwrap_or(0i128);
        if amount <= 0 || from_balance < amount {
            panic!("insufficient balance");
        }

        let to_balance = env.storage().persistent().get(&to_key).unwrap_or(0i128);
        env.storage()
            .persistent()
            .set(&from_key, &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&to_key, &(to_balance + amount));
    }
}

struct TTestContext {
    env: Env,
    escrow_client: EscrowContractClient<'static>,
    reputation_client: ReputationContractClient<'static>,
    mock_usdc_client: token::Client<'static>,
    mock_xlm_client: token::Client<'static>,
    escrow_contract_id: Address,
    platform_admin: Address,
    client: Address,
    freelancer: Address,
    outsider: Address,
    mock_usdc_token: Address,
    mock_xlm_token: Address,
}

fn hash_from_byte(env: &Env, value: u8) -> BytesN<32> {
    BytesN::from_array(env, &[value; 32])
}

fn decode_spec_entry(bytes: &[u8]) -> ScSpecEntry {
    ScSpecEntry::from_xdr(bytes, Limits::none()).unwrap()
}

fn assert_dispute_function_spec(
    spec_bytes: &[u8],
    expected_name: &str,
    expected_inputs: &[(&str, ScSpecTypeDef)],
) {
    let ScSpecEntry::FunctionV0(spec) = decode_spec_entry(spec_bytes) else {
        panic!("expected a function spec for {expected_name}");
    };

    assert_eq!(spec.name.to_string(), expected_name);
    assert_eq!(spec.inputs.len(), expected_inputs.len());
    for (actual, (expected_name, expected_type)) in spec.inputs.iter().zip(expected_inputs) {
        assert_eq!(actual.name.to_string(), *expected_name);
        assert_eq!(actual.type_, expected_type.clone());
    }
    assert_eq!(
        spec.outputs.as_slice(),
        &[ScSpecTypeDef::Result(Box::new(ScSpecTypeResult {
            ok_type: Box::new(ScSpecTypeDef::Tuple(Box::new(ScSpecTypeTuple {
                value_types: std::vec::Vec::<ScSpecTypeDef>::new().try_into().unwrap(),
            }))),
            error_type: Box::new(ScSpecTypeDef::Error),
        }))]
    );
}

fn event_status_value(env: &Env, status_name: &str) -> Val {
    let status_symbols: Vec<Symbol> = soroban_sdk::vec![env, Symbol::new(env, status_name)];
    status_symbols.into_val(env)
}

fn set_timestamp(env: &Env, timestamp: u64) {
    env.ledger().with_mut(|ledger| {
        ledger.timestamp = timestamp;
    });
}

fn setup() -> TTestContext {
    let env = Env::default();
    env.mock_all_auths();

    set_timestamp(&env, 1);

    let platform_admin = Address::generate(&env);
    let client = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let outsider = Address::generate(&env);

    // Mock USDC token contract used for stablecoin-oriented escrow tests.
    let mock_usdc_admin = Address::generate(&env);
    let mock_usdc_token_contract = env.register_stellar_asset_contract_v2(mock_usdc_admin.clone());
    let mock_usdc_token = mock_usdc_token_contract.address();
    let mock_xlm_admin = Address::generate(&env);
    let mock_xlm_token_contract = env.register_stellar_asset_contract_v2(mock_xlm_admin.clone());
    let mock_xlm_token = mock_xlm_token_contract.address();

    let reputation_contract_id = env.register(ReputationContract, ());
    let escrow_contract_id = env.register(EscrowContract, ());

    let env_ref: &'static Env = Box::leak(Box::new(env));

    let reputation_client = ReputationContractClient::new(env_ref, &reputation_contract_id);
    let escrow_client = EscrowContractClient::new(env_ref, &escrow_contract_id);

    reputation_client.initialize(&escrow_contract_id);
    escrow_client.initialize(&reputation_contract_id, &platform_admin);

    let token_admin_client = token::StellarAssetClient::new(env_ref, &mock_usdc_token);
    token_admin_client.mint(&client, &10_000);
    let xlm_admin_client = token::StellarAssetClient::new(env_ref, &mock_xlm_token);
    xlm_admin_client.mint(&client, &20_000);

    TTestContext {
        env: env_ref.clone(),
        escrow_client,
        reputation_client,
        mock_usdc_client: token::Client::new(env_ref, &mock_usdc_token),
        mock_xlm_client: token::Client::new(env_ref, &mock_xlm_token),
        escrow_contract_id,
        platform_admin,
        client,
        freelancer,
        outsider,
        mock_usdc_token,
        mock_xlm_token,
    }
}

fn create_escrow(context: &TTestContext, amount: i128, hash_byte: u8) -> u64 {
    context.escrow_client.create_escrow(
        &context.client,
        &context.freelancer,
        &context.mock_usdc_token,
        &amount,
        &hash_from_byte(&context.env, hash_byte),
    )
}

fn create_open_escrow(context: &TTestContext, amount: i128, hash_byte: u8) -> u64 {
    context.escrow_client.create_open_escrow(
        &context.client,
        &context.mock_usdc_token,
        &amount,
        &hash_from_byte(&context.env, hash_byte),
    )
}

fn fund_escrow(context: &TTestContext, escrow_id: u64) {
    context
        .escrow_client
        .fund_escrow(&context.client, &escrow_id);
}

fn funded_escrow_fixture(
    context: &TTestContext,
    amount: i128,
    hash_byte: u8,
    created_at: u64,
    funded_at: u64,
) -> u64 {
    set_timestamp(&context.env, created_at);
    let escrow_id = create_escrow(context, amount, hash_byte);

    set_timestamp(&context.env, funded_at);
    fund_escrow(context, escrow_id);

    escrow_id
}

fn submit_work(context: &TTestContext, escrow_id: u64) {
    context.escrow_client.submit_work(
        &context.freelancer,
        &escrow_id,
        &hash_from_byte(&context.env, 42),
    );
}

fn submitted_escrow_fixture(
    context: &TTestContext,
    amount: i128,
    hash_byte: u8,
    created_at: u64,
    funded_at: u64,
    submitted_at: u64,
) -> u64 {
    let escrow_id = funded_escrow_fixture(context, amount, hash_byte, created_at, funded_at);

    set_timestamp(&context.env, submitted_at);
    submit_work(context, escrow_id);

    escrow_id
}

type DisputeTokenBalances = (i128, i128, i128);

fn dispute_token_balances_for(
    context: &TTestContext,
    client: &Address,
    freelancer: &Address,
) -> DisputeTokenBalances {
    (
        context.mock_usdc_client.balance(client),
        context.mock_usdc_client.balance(freelancer),
        context
            .mock_usdc_client
            .balance(&context.escrow_contract_id),
    )
}

fn dispute_token_balances(context: &TTestContext) -> DisputeTokenBalances {
    dispute_token_balances_for(context, &context.client, &context.freelancer)
}

fn events_from_topic(
    context: &TTestContext,
    emitter: &Address,
    topic: &str,
) -> std::vec::Vec<(Address, soroban_sdk::Vec<Val>, Val)> {
    context
        .env
        .events()
        .all()
        .iter()
        .filter_map(|(event_emitter, topics, data)| {
            if &event_emitter != emitter {
                return None;
            }
            let first_topic: Symbol = topics.get(0)?.try_into_val(&context.env).ok()?;
            if first_topic != Symbol::new(&context.env, topic) {
                return None;
            }
            Some((event_emitter, topics, data))
        })
        .collect()
}

fn dispute_events(context: &TTestContext) -> std::vec::Vec<(Address, soroban_sdk::Vec<Val>, Val)> {
    events_from_topic(context, &context.escrow_contract_id, "dispute")
}

fn dispute_event_count(context: &TTestContext) -> usize {
    dispute_events(context).len()
}

fn assert_mark_event(context: &TTestContext, event_index: usize, actor: &Address, escrow_id: u64) {
    let records = dispute_events(context);
    assert_eq!(records.len(), event_index + 1);
    let (emitter, topics, data) = &records[event_index];
    assert_eq!(emitter, &context.escrow_contract_id);

    let mut expected_topics: Vec<Val> = Vec::new(&context.env);
    expected_topics.push_back(Symbol::new(&context.env, "dispute").into_val(&context.env));
    expected_topics.push_back(Symbol::new(&context.env, "marked").into_val(&context.env));
    expected_topics.push_back(escrow_id.into_val(&context.env));
    assert_eq!(topics, &expected_topics);

    let expected_payload = DisputeMarkedEvent {
        version: 1,
        actor: actor.clone(),
        status: TEscrowStatus::Disputed,
    };
    let mut expected_data_map: Map<Symbol, Val> = Map::new(&context.env);
    expected_data_map.set(
        Symbol::new(&context.env, "version"),
        1_u32.into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "actor"),
        actor.clone().into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "status"),
        event_status_value(&context.env, "Disputed"),
    );
    let expected_data: Val = expected_data_map.into_val(&context.env);
    let actual_data_xdr: soroban_sdk::xdr::ScVal = data.try_into_val(&context.env).unwrap();
    let expected_data_xdr: soroban_sdk::xdr::ScVal =
        expected_data.try_into_val(&context.env).unwrap();
    assert_eq!(actual_data_xdr, expected_data_xdr);
    let decoded: DisputeMarkedEvent = data.try_into_val(&context.env).unwrap();
    assert_eq!(decoded, expected_payload);

    let emitted_escrow_id: u64 = topics.get(2).unwrap().try_into_val(&context.env).unwrap();
    let persisted_escrow = context.escrow_client.get_escrow(&emitted_escrow_id);
    assert_eq!(emitted_escrow_id, escrow_id);
    assert_eq!(persisted_escrow.escrow_id, emitted_escrow_id);
    assert_eq!(decoded.status, persisted_escrow.status);
}

fn assert_resolve_event(
    context: &TTestContext,
    event_index: usize,
    actor: &Address,
    escrow_id: u64,
    freelancer_share_bps: u32,
    resolution_hash: BytesN<32>,
    before: &TEscrow,
) -> (i128, i128, TEscrowStatus) {
    let records = dispute_events(context);
    assert_eq!(records.len(), event_index + 1);
    let (emitter, topics, data) = &records[event_index];
    assert_eq!(emitter, &context.escrow_contract_id);

    let mut expected_topics: Vec<Val> = Vec::new(&context.env);
    expected_topics.push_back(Symbol::new(&context.env, "dispute").into_val(&context.env));
    expected_topics.push_back(Symbol::new(&context.env, "resolved").into_val(&context.env));
    expected_topics.push_back(escrow_id.into_val(&context.env));
    assert_eq!(topics, &expected_topics);

    let freelancer = before.freelancer.clone().unwrap();
    let (freelancer_amount, client_amount) = match (before.amount, freelancer_share_bps) {
        (301, 0) => (0, 301),
        (301, 3_333) => (100, 201),
        (301, 10_000) => (301, 0),
        (amount, share_bps) => {
            let freelancer_amount = (amount * share_bps as i128) / 10_000;
            (freelancer_amount, amount - freelancer_amount)
        }
    };
    let status = if freelancer_share_bps == 0 {
        TEscrowStatus::Cancelled
    } else {
        TEscrowStatus::Released
    };
    let status_name = if freelancer_share_bps == 0 {
        "Cancelled"
    } else {
        "Released"
    };
    let expected_payload = DisputeResolvedEvent {
        version: 1,
        actor: actor.clone(),
        status: status.clone(),
        resolution_hash: resolution_hash.clone(),
        asset: before.asset.clone(),
        client: before.client.clone(),
        freelancer: freelancer.clone(),
        freelancer_share_bps,
        freelancer_amount,
        client_amount,
    };
    let mut expected_data_map: Map<Symbol, Val> = Map::new(&context.env);
    expected_data_map.set(
        Symbol::new(&context.env, "version"),
        1_u32.into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "actor"),
        actor.clone().into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "status"),
        event_status_value(&context.env, status_name),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "resolution_hash"),
        resolution_hash.clone().into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "asset"),
        before.asset.clone().into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "client"),
        before.client.clone().into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "freelancer"),
        freelancer.clone().into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "freelancer_share_bps"),
        freelancer_share_bps.into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "freelancer_amount"),
        freelancer_amount.into_val(&context.env),
    );
    expected_data_map.set(
        Symbol::new(&context.env, "client_amount"),
        client_amount.into_val(&context.env),
    );
    let expected_data: Val = expected_data_map.into_val(&context.env);
    let actual_data_xdr: soroban_sdk::xdr::ScVal = data.try_into_val(&context.env).unwrap();
    let expected_data_xdr: soroban_sdk::xdr::ScVal =
        expected_data.try_into_val(&context.env).unwrap();
    assert_eq!(actual_data_xdr, expected_data_xdr);
    let decoded: DisputeResolvedEvent = data.try_into_val(&context.env).unwrap();
    assert_eq!(decoded, expected_payload);
    assert_eq!(before.escrow_id, escrow_id);

    (freelancer_amount, client_amount, decoded.status)
}

fn assert_settlement_conservation(
    context: &TTestContext,
    balances_before: DisputeTokenBalances,
    original_amount: i128,
    expected_client_gain: i128,
    expected_freelancer_gain: i128,
) {
    let balances_after = dispute_token_balances(context);
    let (client_before, freelancer_before, contract_before) = balances_before;
    let (client_after, freelancer_after, contract_after) = balances_after;
    let client_gain = client_after - client_before;
    let freelancer_gain = freelancer_after - freelancer_before;
    let contract_balance_decrease = contract_before - contract_after;
    let combined_participant_gains = client_gain + freelancer_gain;

    assert_eq!(contract_before, original_amount);
    assert_eq!(contract_after, 0);
    assert_eq!(client_gain, expected_client_gain);
    assert_eq!(freelancer_gain, expected_freelancer_gain);
    assert_eq!(combined_participant_gains, original_amount);
    assert_eq!(contract_balance_decrease, original_amount);
    assert_eq!(combined_participant_gains, contract_balance_decrease);
}

fn assert_dispute_attempt_preserved_state(
    context: &TTestContext,
    escrow_id: u64,
    before: &TEscrow,
    balances_before: DisputeTokenBalances,
) {
    assert_dispute_attempt_preserved_state_for(
        context,
        escrow_id,
        before,
        &context.client,
        &context.freelancer,
        balances_before,
    );
}

fn assert_dispute_attempt_preserved_state_for(
    context: &TTestContext,
    escrow_id: u64,
    before: &TEscrow,
    client: &Address,
    freelancer: &Address,
    balances_before: DisputeTokenBalances,
) {
    assert_eq!(context.escrow_client.get_escrow(&escrow_id), before.clone());
    assert_eq!(
        dispute_token_balances_for(context, client, freelancer),
        balances_before
    );
}

fn assert_dispute_mark_changed_only_status(
    context: &TTestContext,
    escrow_id: u64,
    before: &TEscrow,
    balances_before: DisputeTokenBalances,
) {
    let mut expected = before.clone();
    expected.status = TEscrowStatus::Disputed;

    assert_eq!(context.escrow_client.get_escrow(&escrow_id), expected);
    assert_eq!(dispute_token_balances(context), balances_before);
}

fn install_mock_dispute_auth(
    context: &TTestContext,
    authorized_address: &Address,
    caller: &Address,
    escrow_id: u64,
) {
    let args = (caller.clone(), escrow_id).into_val(&context.env);
    let invocation = MockAuthInvoke {
        contract: &context.escrow_contract_id,
        fn_name: "mark_disputed",
        args,
        sub_invokes: &[],
    };

    context.env.mock_auths(&[MockAuth {
        address: authorized_address,
        invoke: &invocation,
    }]);
}

fn assert_dispute_auth(
    context: &TTestContext,
    authorized_address: &Address,
    caller: &Address,
    escrow_id: u64,
) {
    let args = (caller.clone(), escrow_id).into_val(&context.env);

    assert_eq!(
        context.env.auths(),
        std::vec![(
            authorized_address.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    context.escrow_contract_id.clone(),
                    Symbol::new(&context.env, "mark_disputed"),
                    args,
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
}

fn assert_mark_disputed_with_auth(
    context: &TTestContext,
    authorized_address: &Address,
    caller: &Address,
    escrow_id: u64,
    expected_error: Option<Error>,
) {
    let event_count_before = dispute_event_count(context);
    let token_transfer_count_before =
        events_from_topic(context, &context.mock_usdc_token, "transfer").len();
    install_mock_dispute_auth(context, authorized_address, caller, escrow_id);
    let result = context.escrow_client.try_mark_disputed(caller, &escrow_id);

    match expected_error {
        Some(error) => {
            assert_eq!(result, Err(Ok(error)));
            assert_eq!(dispute_event_count(context), event_count_before);
            assert_eq!(
                events_from_topic(context, &context.mock_usdc_token, "transfer").len(),
                token_transfer_count_before
            );
        }
        None => {
            assert_dispute_auth(context, authorized_address, caller, escrow_id);
            assert_eq!(result, Ok(Ok(())));
            assert_mark_event(context, 0, caller, escrow_id);
            assert_eq!(
                events_from_topic(context, &context.mock_usdc_token, "transfer").len(),
                token_transfer_count_before
            );
        }
    }
}

fn valid_dispute_entry_fixture(
    context: &TTestContext,
    status: TEscrowStatus,
    hash_byte: u8,
) -> u64 {
    context.env.mock_all_auths();
    match status {
        TEscrowStatus::Funded => funded_escrow_fixture(
            context,
            150,
            hash_byte,
            u64::from(hash_byte) + 1,
            u64::from(hash_byte) + 2,
        ),
        TEscrowStatus::Submitted => submitted_escrow_fixture(
            context,
            150,
            hash_byte,
            u64::from(hash_byte) + 1,
            u64::from(hash_byte) + 2,
            u64::from(hash_byte) + 3,
        ),
        _ => panic!("dispute entry fixture requires Funded or Submitted status"),
    }
}

fn disputed_escrow_fixture(
    context: &TTestContext,
    initial_status: TEscrowStatus,
    amount: i128,
    hash_byte: u8,
) -> u64 {
    context.env.mock_all_auths();
    let escrow_id = match &initial_status {
        TEscrowStatus::Funded => funded_escrow_fixture(
            context,
            amount,
            hash_byte,
            u64::from(hash_byte) + 1,
            u64::from(hash_byte) + 2,
        ),
        TEscrowStatus::Submitted => submitted_escrow_fixture(
            context,
            amount,
            hash_byte,
            u64::from(hash_byte) + 1,
            u64::from(hash_byte) + 2,
            u64::from(hash_byte) + 3,
        ),
        _ => panic!("dispute fixture requires Funded or Submitted status"),
    };
    let marker = match initial_status {
        TEscrowStatus::Funded => &context.client,
        TEscrowStatus::Submitted => &context.freelancer,
        _ => panic!("dispute fixture requires Funded or Submitted status"),
    };
    context.escrow_client.mark_disputed(marker, &escrow_id);
    escrow_id
}

fn install_mock_resolve_auth(
    context: &TTestContext,
    authorized_address: &Address,
    dispute_admin: &Address,
    escrow_id: u64,
    freelancer_share_bps: u32,
    hash_byte: u8,
) {
    let resolution_hash = hash_from_byte(&context.env, hash_byte);
    let args = (
        dispute_admin.clone(),
        escrow_id,
        freelancer_share_bps,
        resolution_hash,
    )
        .into_val(&context.env);
    let invocation = MockAuthInvoke {
        contract: &context.escrow_contract_id,
        fn_name: "resolve_dispute",
        args,
        sub_invokes: &[],
    };

    context.env.mock_auths(&[MockAuth {
        address: authorized_address,
        invoke: &invocation,
    }]);
}

fn assert_resolve_dispute_auth(
    context: &TTestContext,
    authorized_address: &Address,
    dispute_admin: &Address,
    escrow_id: u64,
    freelancer_share_bps: u32,
    hash_byte: u8,
) {
    let args = (
        dispute_admin.clone(),
        escrow_id,
        freelancer_share_bps,
        hash_from_byte(&context.env, hash_byte),
    )
        .into_val(&context.env);

    assert_eq!(
        context.env.auths(),
        std::vec![(
            authorized_address.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    context.escrow_contract_id.clone(),
                    Symbol::new(&context.env, "resolve_dispute"),
                    args,
                )),
                sub_invocations: std::vec![],
            }
        )]
    );
}

fn assert_resolve_dispute_with_auth(
    context: &TTestContext,
    authorized_address: &Address,
    dispute_admin: &Address,
    escrow_id: u64,
    freelancer_share_bps: u32,
    hash_byte: u8,
    expected_error: Option<Error>,
) -> Option<TEscrowStatus> {
    let event_count_before = dispute_event_count(context);
    let escrow_before = context.escrow_client.get_escrow(&escrow_id);
    let token_transfer_count_before =
        events_from_topic(context, &escrow_before.asset, "transfer").len();
    install_mock_resolve_auth(
        context,
        authorized_address,
        dispute_admin,
        escrow_id,
        freelancer_share_bps,
        hash_byte,
    );
    let resolution_hash = hash_from_byte(&context.env, hash_byte);
    let result = context.escrow_client.try_resolve_dispute(
        dispute_admin,
        &escrow_id,
        &freelancer_share_bps,
        &resolution_hash,
    );

    let event_status = match expected_error {
        Some(error) => {
            assert_eq!(result, Err(Ok(error)));
            assert_eq!(dispute_event_count(context), event_count_before);
            assert_eq!(
                events_from_topic(context, &escrow_before.asset, "transfer").len(),
                token_transfer_count_before
            );
            None
        }
        None => {
            assert_resolve_dispute_auth(
                context,
                authorized_address,
                dispute_admin,
                escrow_id,
                freelancer_share_bps,
                hash_byte,
            );
            assert_eq!(result, Ok(Ok(())));
            let (freelancer_amount, client_amount, event_status) = assert_resolve_event(
                context,
                0,
                dispute_admin,
                escrow_id,
                freelancer_share_bps,
                resolution_hash,
                &escrow_before,
            );
            let expected_transfer_count =
                usize::from(freelancer_amount > 0) + usize::from(client_amount > 0);
            assert_eq!(
                events_from_topic(context, &escrow_before.asset, "transfer").len(),
                token_transfer_count_before + expected_transfer_count
            );
            Some(event_status)
        }
    };
    context.env.mock_all_auths();
    event_status
}

fn escrow_fixture_with_status(context: &TTestContext, status: TEscrowStatus, hash_byte: u8) -> u64 {
    context.env.mock_all_auths();
    match status {
        TEscrowStatus::Created => create_escrow(context, 150, hash_byte),
        TEscrowStatus::Funded => funded_escrow_fixture(
            context,
            150,
            hash_byte,
            u64::from(hash_byte) + 1,
            u64::from(hash_byte) + 2,
        ),
        TEscrowStatus::Submitted => submitted_escrow_fixture(
            context,
            150,
            hash_byte,
            u64::from(hash_byte) + 1,
            u64::from(hash_byte) + 2,
            u64::from(hash_byte) + 3,
        ),
        TEscrowStatus::Released => {
            let escrow_id = submitted_escrow_fixture(
                context,
                150,
                hash_byte,
                u64::from(hash_byte) + 1,
                u64::from(hash_byte) + 2,
                u64::from(hash_byte) + 3,
            );
            context.escrow_client.approve_and_release(
                &context.client,
                &escrow_id,
                &5,
                &hash_from_byte(&context.env, hash_byte.wrapping_add(1)),
            );
            escrow_id
        }
        TEscrowStatus::Cancelled => {
            let escrow_id = funded_escrow_fixture(
                context,
                150,
                hash_byte,
                u64::from(hash_byte) + 1,
                u64::from(hash_byte) + 2,
            );
            context
                .escrow_client
                .cancel_escrow(&context.client, &escrow_id);
            escrow_id
        }
        TEscrowStatus::Disputed => panic!("use disputed_escrow_fixture for Disputed status"),
    }
}

#[derive(Clone, Copy, Debug)]
enum C20Action {
    Fund,
    Submit,
    Release,
    Cancel,
    Mark,
    Resolve,
}

fn assert_c20_rejected_action_preserves_state(
    context: &TTestContext,
    escrow_id: u64,
    action: C20Action,
    actor: &Address,
) {
    let before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = dispute_token_balances(context);
    let completion_before = context.reputation_client.get_completion(&escrow_id);
    let stats_before = context
        .reputation_client
        .get_freelancer_stats(&context.freelancer);
    let dispute_events_before = dispute_event_count(context);
    let transfers_before = events_from_topic(context, &before.asset, "transfer").len();

    set_timestamp(&context.env, context.env.ledger().timestamp() + 100);
    let hash = hash_from_byte(&context.env, 240);
    let (fn_name, args) = match action {
        C20Action::Fund => (
            "fund_escrow",
            (actor.clone(), escrow_id).into_val(&context.env),
        ),
        C20Action::Submit => (
            "submit_work",
            (actor.clone(), escrow_id, hash.clone()).into_val(&context.env),
        ),
        C20Action::Release => (
            "approve_and_release",
            (actor.clone(), escrow_id, 5u32, hash.clone()).into_val(&context.env),
        ),
        C20Action::Cancel => (
            "cancel_escrow",
            (actor.clone(), escrow_id).into_val(&context.env),
        ),
        C20Action::Mark => (
            "mark_disputed",
            (actor.clone(), escrow_id).into_val(&context.env),
        ),
        C20Action::Resolve => (
            "resolve_dispute",
            (actor.clone(), escrow_id, 5_000u32, hash.clone()).into_val(&context.env),
        ),
    };
    context.env.mock_auths(&[MockAuth {
        address: actor,
        invoke: &MockAuthInvoke {
            contract: &context.escrow_contract_id,
            fn_name,
            args,
            sub_invokes: &[],
        },
    }]);

    let result = match action {
        C20Action::Fund => context.escrow_client.try_fund_escrow(actor, &escrow_id),
        C20Action::Submit => context
            .escrow_client
            .try_submit_work(actor, &escrow_id, &hash),
        C20Action::Release => context
            .escrow_client
            .try_approve_and_release(actor, &escrow_id, &5, &hash),
        C20Action::Cancel => context.escrow_client.try_cancel_escrow(actor, &escrow_id),
        C20Action::Mark => context.escrow_client.try_mark_disputed(actor, &escrow_id),
        C20Action::Resolve => context
            .escrow_client
            .try_resolve_dispute(actor, &escrow_id, &5_000, &hash),
    };
    assert_eq!(
        result,
        Err(Ok(Error::InvalidStatus)),
        "{action:?} from {:?}",
        before.status
    );
    assert_eq!(dispute_event_count(context), dispute_events_before);
    assert_eq!(
        events_from_topic(context, &before.asset, "transfer").len(),
        transfers_before
    );
    assert_dispute_attempt_preserved_state(context, escrow_id, &before, balances_before);
    assert_eq!(
        context.reputation_client.get_completion(&escrow_id),
        completion_before
    );
    assert_eq!(
        context
            .reputation_client
            .get_freelancer_stats(&context.freelancer),
        stats_before
    );
    context.env.mock_all_auths();
}

fn assert_c20_disputed_action(action: C20Action) {
    for initial_status in [TEscrowStatus::Funded, TEscrowStatus::Submitted] {
        let context = setup();
        let escrow_id = disputed_escrow_fixture(&context, initial_status, 301, 200);
        assert_eq!(
            context.escrow_client.get_escrow(&escrow_id).status,
            TEscrowStatus::Disputed
        );
        assert_eq!(context.reputation_client.get_completion(&escrow_id), None);
        match action {
            C20Action::Mark => {
                for actor in [
                    &context.client,
                    &context.freelancer,
                    &context.platform_admin,
                ] {
                    assert_c20_rejected_action_preserves_state(&context, escrow_id, action, actor);
                }
            }
            _ => {
                let actor = if matches!(action, C20Action::Submit) {
                    &context.freelancer
                } else {
                    &context.client
                };
                assert_c20_rejected_action_preserves_state(&context, escrow_id, action, actor);
            }
        }
    }
}

fn assert_c20_terminal_actions(context: &TTestContext, escrow_id: u64) {
    for (action, actor) in [
        (C20Action::Fund, &context.client),
        (C20Action::Submit, &context.freelancer),
        (C20Action::Release, &context.client),
        (C20Action::Cancel, &context.client),
        (C20Action::Mark, &context.client),
        (C20Action::Mark, &context.freelancer),
        (C20Action::Mark, &context.platform_admin),
        (C20Action::Resolve, &context.platform_admin),
    ] {
        assert_c20_rejected_action_preserves_state(context, escrow_id, action, actor);
    }
}

#[test]
fn dispute_method_specs_are_frozen() {
    assert_dispute_function_spec(
        &EscrowContract::spec_xdr_mark_disputed(),
        "mark_disputed",
        &[
            ("caller", ScSpecTypeDef::Address),
            ("escrow_id", ScSpecTypeDef::U64),
        ],
    );
    assert_dispute_function_spec(
        &EscrowContract::spec_xdr_resolve_dispute(),
        "resolve_dispute",
        &[
            ("dispute_admin", ScSpecTypeDef::Address),
            ("escrow_id", ScSpecTypeDef::U64),
            ("freelancer_share_bps", ScSpecTypeDef::U32),
            (
                "_resolution_hash",
                ScSpecTypeDef::BytesN(ScSpecTypeBytesN { n: 32 }),
            ),
        ],
    );
}

#[test]
fn status_names_and_symbol_vector_encoding_are_frozen() {
    let env = Env::default();
    let statuses = [
        (TEscrowStatus::Created, "Created"),
        (TEscrowStatus::Funded, "Funded"),
        (TEscrowStatus::Submitted, "Submitted"),
        (TEscrowStatus::Released, "Released"),
        (TEscrowStatus::Cancelled, "Cancelled"),
        (TEscrowStatus::Disputed, "Disputed"),
    ];

    for (status, expected_name) in statuses {
        let actual: Val = status.into_val(&env);
        let expected = event_status_value(&env, expected_name);
        let actual_xdr: soroban_sdk::xdr::ScVal = actual.try_into_val(&env).unwrap();
        let expected_xdr: soroban_sdk::xdr::ScVal = expected.try_into_val(&env).unwrap();
        assert_eq!(actual_xdr, expected_xdr);
    }
}

#[test]
fn contract_error_names_and_codes_are_frozen() {
    let ScSpecEntry::UdtErrorEnumV0(spec) = decode_spec_entry(&Error::spec_xdr()) else {
        panic!("expected the escrow contract error spec");
    };
    assert_eq!(spec.name.to_string(), "Error");

    let expected = [
        ("AlreadyInitialized", 1),
        ("NotInitialized", 2),
        ("Unauthorized", 3),
        ("InvalidAmount", 4),
        ("EscrowNotFound", 5),
        ("InvalidStatus", 6),
        ("InvalidRating", 7),
        ("InvalidFreelancer", 8),
        ("AssetNotAllowed", 9),
        ("InvalidShareBps", 10),
    ];
    let actual = spec
        .cases
        .iter()
        .map(|case| (case.name.to_string(), case.value))
        .collect::<std::vec::Vec<_>>();
    let expected_specs = expected
        .iter()
        .map(|(name, code)| ((*name).to_string(), *code))
        .collect::<std::vec::Vec<_>>();
    assert_eq!(actual, expected_specs);

    let actual_codes = [
        Error::AlreadyInitialized as u32,
        Error::NotInitialized as u32,
        Error::Unauthorized as u32,
        Error::InvalidAmount as u32,
        Error::EscrowNotFound as u32,
        Error::InvalidStatus as u32,
        Error::InvalidRating as u32,
        Error::InvalidFreelancer as u32,
        Error::AssetNotAllowed as u32,
        Error::InvalidShareBps as u32,
    ];
    assert_eq!(actual_codes, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
}

#[test]
fn c20_disputed_escrows_cannot_be_submitted() {
    assert_c20_disputed_action(C20Action::Submit);
}

#[test]
fn c20_disputed_escrows_cannot_be_released() {
    assert_c20_disputed_action(C20Action::Release);
}

#[test]
fn c20_disputed_escrows_cannot_be_cancelled() {
    assert_c20_disputed_action(C20Action::Cancel);
}

#[test]
fn c20_disputed_escrows_cannot_be_disputed_again() {
    assert_c20_disputed_action(C20Action::Mark);
}

#[test]
fn c20_settlement_terminal_outcomes_cannot_be_reentered() {
    for initial_status in [TEscrowStatus::Funded, TEscrowStatus::Submitted] {
        for share_bps in [0, 3_333, 10_000] {
            let context = setup();
            let escrow_id = disputed_escrow_fixture(&context, initial_status.clone(), 301, 210);
            set_timestamp(&context.env, 300);
            assert_resolve_dispute_with_auth(
                &context,
                &context.platform_admin,
                &context.platform_admin,
                escrow_id,
                share_bps,
                211,
                None,
            );
            let expected_status = if share_bps == 0 {
                TEscrowStatus::Cancelled
            } else {
                TEscrowStatus::Released
            };
            assert_eq!(
                context.escrow_client.get_escrow(&escrow_id).status,
                expected_status
            );
            assert_eq!(context.reputation_client.get_completion(&escrow_id), None);
            assert_c20_terminal_actions(&context, escrow_id);
        }
    }
}

#[test]
fn c20_ordinary_terminal_outcomes_cannot_be_reentered() {
    let context = setup();
    let released_id = escrow_fixture_with_status(&context, TEscrowStatus::Released, 220);
    assert_eq!(
        context.escrow_client.get_escrow(&released_id).status,
        TEscrowStatus::Released
    );
    assert!(context.reputation_client.has_completion(&released_id));
    assert_c20_terminal_actions(&context, released_id);

    for initial_status in [TEscrowStatus::Created, TEscrowStatus::Funded] {
        let context = setup();
        let escrow_id = escrow_fixture_with_status(&context, initial_status, 230);
        context
            .escrow_client
            .cancel_escrow(&context.client, &escrow_id);
        assert_eq!(
            context.escrow_client.get_escrow(&escrow_id).status,
            TEscrowStatus::Cancelled
        );
        assert_eq!(context.reputation_client.get_completion(&escrow_id), None);
        assert_c20_terminal_actions(&context, escrow_id);
    }
}

#[test]
fn initialize_works() {
    let context = setup();

    assert_eq!(context.escrow_client.is_initialized(), true);
    assert_eq!(
        context.escrow_client.get_reputation_contract(),
        context.reputation_client.address
    );
    assert_eq!(
        context.escrow_client.get_platform_admin(),
        context.platform_admin
    );
    assert_eq!(context.escrow_client.get_next_escrow_id(), 1);
}

#[test]
fn initialize_cannot_be_called_twice() {
    let context = setup();

    let result = context
        .escrow_client
        .try_initialize(&context.reputation_client.address, &context.platform_admin);

    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn create_escrow_works() {
    let context = setup();

    set_timestamp(&context.env, 5);
    let escrow_id = create_escrow(&context, 500, 1);

    let escrow: TEscrow = context.escrow_client.get_escrow(&escrow_id);

    assert_eq!(escrow_id, 1);
    assert_eq!(escrow.status, TEscrowStatus::Created);
    assert_eq!(escrow.client, context.client);
    assert_eq!(escrow.freelancer, Some(context.freelancer.clone()));
    assert_eq!(escrow.asset, context.mock_usdc_token);
    assert_eq!(escrow.amount, 500);
    assert_eq!(escrow.job_hash, hash_from_byte(&context.env, 1));
    assert_eq!(escrow.created_at, 5);
    assert_eq!(escrow.funded_at, 0);
    assert_eq!(escrow.submitted_at, 0);
    assert_eq!(escrow.released_at, 0);
    assert_eq!(context.escrow_client.get_next_escrow_id(), 2);
}

#[test]
fn multiple_milestone_escrows_can_share_parent_parties_with_distinct_hashes() {
    let context = setup();

    let first_milestone_escrow_id = create_escrow(&context, 100, 51);
    let second_milestone_escrow_id = create_escrow(&context, 250, 52);

    assert_ne!(first_milestone_escrow_id, second_milestone_escrow_id);

    let first_escrow: TEscrow = context.escrow_client.get_escrow(&first_milestone_escrow_id);
    let second_escrow: TEscrow = context
        .escrow_client
        .get_escrow(&second_milestone_escrow_id);

    assert_eq!(first_escrow.client, context.client);
    assert_eq!(second_escrow.client, context.client);
    assert_eq!(first_escrow.freelancer, Some(context.freelancer.clone()));
    assert_eq!(second_escrow.freelancer, Some(context.freelancer.clone()));
    assert_eq!(first_escrow.amount, 100);
    assert_eq!(second_escrow.amount, 250);
    assert_eq!(first_escrow.job_hash, hash_from_byte(&context.env, 51));
    assert_eq!(second_escrow.job_hash, hash_from_byte(&context.env, 52));
    assert_eq!(first_escrow.status, TEscrowStatus::Created);
    assert_eq!(second_escrow.status, TEscrowStatus::Created);
}

#[test]
fn create_open_escrow_works() {
    let context = setup();

    set_timestamp(&context.env, 6);
    let escrow_id = create_open_escrow(&context, 475, 54);

    let escrow: TEscrow = context.escrow_client.get_escrow(&escrow_id);

    assert_eq!(escrow.status, TEscrowStatus::Created);
    assert_eq!(escrow.client, context.client);
    assert_eq!(escrow.freelancer, None);
    assert_eq!(escrow.amount, 475);
    assert_eq!(escrow.created_at, 6);
    assert_eq!(escrow.funded_at, 0);
}

#[test]
fn create_and_fund_open_escrow_works() {
    let context = setup();

    set_timestamp(&context.env, 7);
    let escrow_id = context.escrow_client.create_and_fund_open_escrow(
        &context.client,
        &context.mock_usdc_token,
        &650,
        &hash_from_byte(&context.env, 55),
    );

    let escrow = context.escrow_client.get_escrow(&escrow_id);

    assert_eq!(escrow.status, TEscrowStatus::Funded);
    assert_eq!(escrow.freelancer, None);
    assert_eq!(escrow.funded_at, 7);
    assert_eq!(context.mock_usdc_client.balance(&context.client), 9_350);
    assert_eq!(
        context
            .mock_usdc_client
            .balance(&context.escrow_contract_id),
        650
    );
}

#[test]
fn create_escrow_rejects_invalid_amount() {
    let context = setup();

    let zero_result = context.escrow_client.try_create_escrow(
        &context.client,
        &context.freelancer,
        &context.mock_usdc_token,
        &0,
        &hash_from_byte(&context.env, 2),
    );
    assert_eq!(zero_result, Err(Ok(Error::InvalidAmount)));

    let negative_result = context.escrow_client.try_create_escrow(
        &context.client,
        &context.freelancer,
        &context.mock_usdc_token,
        &-1,
        &hash_from_byte(&context.env, 3),
    );
    assert_eq!(negative_result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn create_escrow_rejects_same_client_and_freelancer() {
    let context = setup();

    let result = context.escrow_client.try_create_escrow(
        &context.client,
        &context.client,
        &context.mock_usdc_token,
        &100,
        &hash_from_byte(&context.env, 4),
    );

    assert_eq!(result, Err(Ok(Error::InvalidFreelancer)));
}

#[test]
fn fund_escrow_works() {
    let context = setup();

    let escrow_id = create_escrow(&context, 600, 5);

    set_timestamp(&context.env, 10);
    fund_escrow(&context, escrow_id);

    let escrow = context.escrow_client.get_escrow(&escrow_id);

    assert_eq!(escrow.status, TEscrowStatus::Funded);
    assert_eq!(escrow.funded_at, 10);
    assert_eq!(context.mock_usdc_client.balance(&context.client), 9_400);
    assert_eq!(
        context
            .mock_usdc_client
            .balance(&context.escrow_contract_id),
        600
    );
}

#[test]
fn unauthorized_fund_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 200, 6);

    let result = context
        .escrow_client
        .try_fund_escrow(&context.outsider, &escrow_id);

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn fund_wrong_status_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 250, 7);
    fund_escrow(&context, escrow_id);

    let second_fund = context
        .escrow_client
        .try_fund_escrow(&context.client, &escrow_id);
    assert_eq!(second_fund, Err(Ok(Error::InvalidStatus)));

    let second_escrow_id = create_escrow(&context, 300, 8);
    context
        .escrow_client
        .cancel_escrow(&context.client, &second_escrow_id);

    let cancelled_fund = context
        .escrow_client
        .try_fund_escrow(&context.client, &second_escrow_id);
    assert_eq!(cancelled_fund, Err(Ok(Error::InvalidStatus)));
}

#[test]
fn assign_freelancer_works_for_open_escrow() {
    let context = setup();

    let escrow_id = create_open_escrow(&context, 425, 56);
    context
        .escrow_client
        .assign_freelancer(&context.client, &escrow_id, &context.freelancer);

    let escrow = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.freelancer, Some(context.freelancer.clone()));
}

#[test]
fn assign_freelancer_works_for_prefunded_open_escrow() {
    let context = setup();

    let escrow_id = context.escrow_client.create_and_fund_open_escrow(
        &context.client,
        &context.mock_usdc_token,
        &725,
        &hash_from_byte(&context.env, 57),
    );

    context
        .escrow_client
        .assign_freelancer(&context.client, &escrow_id, &context.freelancer);
    submit_work(&context, escrow_id);

    let escrow = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, TEscrowStatus::Submitted);
    assert_eq!(escrow.freelancer, Some(context.freelancer.clone()));
}

#[test]
fn assign_freelancer_rejects_unauthorized_client_self_and_existing_assignment() {
    let context = setup();

    let escrow_id = create_open_escrow(&context, 300, 58);

    let unauthorized = context.escrow_client.try_assign_freelancer(
        &context.outsider,
        &escrow_id,
        &context.freelancer,
    );
    assert_eq!(unauthorized, Err(Ok(Error::Unauthorized)));

    let self_assignment =
        context
            .escrow_client
            .try_assign_freelancer(&context.client, &escrow_id, &context.client);
    assert_eq!(self_assignment, Err(Ok(Error::InvalidFreelancer)));

    context
        .escrow_client
        .assign_freelancer(&context.client, &escrow_id, &context.freelancer);

    let second_freelancer = Address::generate(&context.env);
    let already_assigned = context.escrow_client.try_assign_freelancer(
        &context.client,
        &escrow_id,
        &second_freelancer,
    );
    assert_eq!(already_assigned, Err(Ok(Error::InvalidStatus)));
}

#[test]
fn unassigned_funded_escrow_rejects_freelancer_required_actions() {
    let context = setup();

    let escrow_id = context.escrow_client.create_and_fund_open_escrow(
        &context.client,
        &context.mock_usdc_token,
        &825,
        &hash_from_byte(&context.env, 59),
    );

    let submit = context.escrow_client.try_submit_work(
        &context.freelancer,
        &escrow_id,
        &hash_from_byte(&context.env, 42),
    );
    assert_eq!(submit, Err(Ok(Error::InvalidFreelancer)));

    let release = context.escrow_client.try_approve_and_release(
        &context.client,
        &escrow_id,
        &5,
        &hash_from_byte(&context.env, 60),
    );
    assert_eq!(release, Err(Ok(Error::InvalidStatus)));

    let before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = dispute_token_balances(&context);
    for caller in [
        &context.client,
        &context.freelancer,
        &context.platform_admin,
    ] {
        assert_mark_disputed_with_auth(
            &context,
            caller,
            caller,
            escrow_id,
            Some(Error::InvalidFreelancer),
        );
        assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
    }
}

#[test]
fn submit_work_works() {
    let context = setup();

    let escrow_id = create_escrow(&context, 800, 9);
    fund_escrow(&context, escrow_id);

    set_timestamp(&context.env, 20);
    submit_work(&context, escrow_id);

    let escrow = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, TEscrowStatus::Submitted);
    assert_eq!(escrow.submitted_at, 20);
    assert_eq!(escrow.proof_hash, Some(hash_from_byte(&context.env, 42)));
}

#[test]
fn unauthorized_submit_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 220, 10);
    fund_escrow(&context, escrow_id);

    let result = context.escrow_client.try_submit_work(
        &context.outsider,
        &escrow_id,
        &hash_from_byte(&context.env, 42),
    );

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn submit_wrong_status_fails() {
    let context = setup();

    let created_escrow_id = create_escrow(&context, 220, 11);
    let before_funding = context.escrow_client.try_submit_work(
        &context.freelancer,
        &created_escrow_id,
        &hash_from_byte(&context.env, 42),
    );
    assert_eq!(before_funding, Err(Ok(Error::InvalidStatus)));

    let escrow_id = create_escrow(&context, 400, 12);
    fund_escrow(&context, escrow_id);
    submit_work(&context, escrow_id);

    context.escrow_client.approve_and_release(
        &context.client,
        &escrow_id,
        &5,
        &hash_from_byte(&context.env, 13),
    );

    let after_release = context.escrow_client.try_submit_work(
        &context.freelancer,
        &escrow_id,
        &hash_from_byte(&context.env, 42),
    );
    assert_eq!(after_release, Err(Ok(Error::InvalidStatus)));

    let cancelled_escrow_id = create_escrow(&context, 330, 14);
    context
        .escrow_client
        .cancel_escrow(&context.client, &cancelled_escrow_id);

    let after_cancel = context.escrow_client.try_submit_work(
        &context.freelancer,
        &cancelled_escrow_id,
        &hash_from_byte(&context.env, 42),
    );
    assert_eq!(after_cancel, Err(Ok(Error::InvalidStatus)));
}

#[test]
fn approve_and_release_works() {
    let context = setup();

    let escrow_id = create_escrow(&context, 900, 15);
    fund_escrow(&context, escrow_id);
    submit_work(&context, escrow_id);

    set_timestamp(&context.env, 30);
    context.escrow_client.approve_and_release(
        &context.client,
        &escrow_id,
        &4,
        &hash_from_byte(&context.env, 16),
    );

    let escrow = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, TEscrowStatus::Released);
    assert_eq!(escrow.released_at, 30);

    assert_eq!(
        context
            .mock_usdc_client
            .balance(&context.escrow_contract_id),
        0
    );
    assert_eq!(context.mock_usdc_client.balance(&context.freelancer), 900);

    assert_eq!(context.reputation_client.has_completion(&escrow_id), true);

    let completion = context
        .reputation_client
        .get_completion(&escrow_id)
        .unwrap();
    assert_eq!(completion.escrow_id, escrow_id);
    assert_eq!(completion.client, context.client);
    assert_eq!(completion.freelancer, context.freelancer);
    assert_eq!(completion.asset, context.mock_usdc_token);
    assert_eq!(completion.amount, 900);
    assert_eq!(completion.job_hash, hash_from_byte(&context.env, 15));
    assert_eq!(completion.rating, 4);
    assert_eq!(completion.review_hash, hash_from_byte(&context.env, 16));

    let stats: TFreelancerStatsView = context
        .reputation_client
        .get_freelancer_stats(&context.freelancer);
    assert_eq!(stats.completed_jobs_count, 1);
    assert_eq!(stats.total_earned, 900);
    assert_eq!(stats.total_rating, 4);
    assert_eq!(stats.average_rating, 4);
}

#[test]
fn unauthorized_approve_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 340, 17);
    fund_escrow(&context, escrow_id);
    submit_work(&context, escrow_id);

    let result = context.escrow_client.try_approve_and_release(
        &context.outsider,
        &escrow_id,
        &5,
        &hash_from_byte(&context.env, 18),
    );

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn approve_wrong_status_fails() {
    let context = setup();

    let before_submit_id = create_escrow(&context, 500, 19);
    fund_escrow(&context, before_submit_id);

    let before_submit = context.escrow_client.try_approve_and_release(
        &context.client,
        &before_submit_id,
        &5,
        &hash_from_byte(&context.env, 20),
    );
    assert_eq!(before_submit, Err(Ok(Error::InvalidStatus)));

    submit_work(&context, before_submit_id);
    context.escrow_client.approve_and_release(
        &context.client,
        &before_submit_id,
        &5,
        &hash_from_byte(&context.env, 21),
    );

    let second_approve = context.escrow_client.try_approve_and_release(
        &context.client,
        &before_submit_id,
        &5,
        &hash_from_byte(&context.env, 22),
    );
    assert_eq!(second_approve, Err(Ok(Error::InvalidStatus)));

    let cancelled_id = create_escrow(&context, 440, 23);
    context
        .escrow_client
        .cancel_escrow(&context.client, &cancelled_id);

    let cancelled_approve = context.escrow_client.try_approve_and_release(
        &context.client,
        &cancelled_id,
        &5,
        &hash_from_byte(&context.env, 24),
    );
    assert_eq!(cancelled_approve, Err(Ok(Error::InvalidStatus)));

    let disputed_id = create_escrow(&context, 410, 25);
    fund_escrow(&context, disputed_id);
    context
        .escrow_client
        .mark_disputed(&context.client, &disputed_id);

    let disputed_approve = context.escrow_client.try_approve_and_release(
        &context.client,
        &disputed_id,
        &5,
        &hash_from_byte(&context.env, 26),
    );
    assert_eq!(disputed_approve, Err(Ok(Error::InvalidStatus)));
}

#[test]
fn invalid_rating_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 360, 27);
    fund_escrow(&context, escrow_id);
    submit_work(&context, escrow_id);

    let zero_rating = context.escrow_client.try_approve_and_release(
        &context.client,
        &escrow_id,
        &0,
        &hash_from_byte(&context.env, 28),
    );
    assert_eq!(zero_rating, Err(Ok(Error::InvalidRating)));

    let over_max_rating = context.escrow_client.try_approve_and_release(
        &context.client,
        &escrow_id,
        &6,
        &hash_from_byte(&context.env, 29),
    );
    assert_eq!(over_max_rating, Err(Ok(Error::InvalidRating)));
}

#[test]
fn cancel_created_escrow_works() {
    let context = setup();

    let escrow_id = create_escrow(&context, 280, 30);
    let client_balance_before = context.mock_usdc_client.balance(&context.client);

    context
        .escrow_client
        .cancel_escrow(&context.client, &escrow_id);

    let escrow = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, TEscrowStatus::Cancelled);
    assert_eq!(
        context.mock_usdc_client.balance(&context.client),
        client_balance_before
    );
    assert_eq!(
        context
            .mock_usdc_client
            .balance(&context.escrow_contract_id),
        0
    );
}

#[test]
fn cancel_funded_escrow_refunds_client() {
    let context = setup();

    let escrow_id = create_escrow(&context, 700, 31);
    fund_escrow(&context, escrow_id);

    assert_eq!(context.mock_usdc_client.balance(&context.client), 9_300);
    assert_eq!(
        context
            .mock_usdc_client
            .balance(&context.escrow_contract_id),
        700
    );

    context
        .escrow_client
        .cancel_escrow(&context.client, &escrow_id);

    let escrow = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, TEscrowStatus::Cancelled);
    assert_eq!(context.mock_usdc_client.balance(&context.client), 10_000);
    assert_eq!(
        context
            .mock_usdc_client
            .balance(&context.escrow_contract_id),
        0
    );
}

#[test]
fn cancel_submitted_escrow_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 550, 32);
    fund_escrow(&context, escrow_id);
    submit_work(&context, escrow_id);

    let result = context
        .escrow_client
        .try_cancel_escrow(&context.client, &escrow_id);

    assert_eq!(result, Err(Ok(Error::InvalidStatus)));
}

#[test]
fn unauthorized_cancel_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 200, 33);

    let result = context
        .escrow_client
        .try_cancel_escrow(&context.outsider, &escrow_id);

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn mark_disputed_accepts_each_authorized_role_from_funded_and_submitted() {
    let context = setup();

    for (role_index, caller) in [
        &context.client,
        &context.freelancer,
        &context.platform_admin,
    ]
    .into_iter()
    .enumerate()
    {
        let funded_id = valid_dispute_entry_fixture(
            &context,
            TEscrowStatus::Funded,
            34 + (role_index as u8 * 2),
        );
        let funded_before = context.escrow_client.get_escrow(&funded_id);
        let funded_balances_before = dispute_token_balances(&context);
        assert_eq!(funded_before.status, TEscrowStatus::Funded);
        assert_mark_disputed_with_auth(&context, caller, caller, funded_id, None);
        assert_dispute_mark_changed_only_status(
            &context,
            funded_id,
            &funded_before,
            funded_balances_before,
        );

        let submitted_id = valid_dispute_entry_fixture(
            &context,
            TEscrowStatus::Submitted,
            35 + (role_index as u8 * 2),
        );
        let submitted_before = context.escrow_client.get_escrow(&submitted_id);
        let submitted_balances_before = dispute_token_balances(&context);
        assert_eq!(submitted_before.status, TEscrowStatus::Submitted);
        assert_mark_disputed_with_auth(&context, caller, caller, submitted_id, None);
        assert_dispute_mark_changed_only_status(
            &context,
            submitted_id,
            &submitted_before,
            submitted_balances_before,
        );
    }
}

#[test]
fn c07_mark_events_identify_the_changed_escrow_and_preserve_unrelated_state() {
    let context = setup();
    let funded_id = valid_dispute_entry_fixture(&context, TEscrowStatus::Funded, 240);
    let submitted_id = valid_dispute_entry_fixture(&context, TEscrowStatus::Submitted, 241);
    let funded_before = context.escrow_client.get_escrow(&funded_id);
    let submitted_before = context.escrow_client.get_escrow(&submitted_id);
    let balances_before = dispute_token_balances(&context);
    let stats_before = context
        .reputation_client
        .get_freelancer_stats(&context.freelancer);
    let funded_completion_before = context.reputation_client.get_completion(&funded_id);
    let submitted_completion_before = context.reputation_client.get_completion(&submitted_id);

    assert_eq!(funded_before.status, TEscrowStatus::Funded);
    assert_eq!(submitted_before.status, TEscrowStatus::Submitted);
    assert_mark_disputed_with_auth(&context, &context.client, &context.client, funded_id, None);
    assert_dispute_mark_changed_only_status(&context, funded_id, &funded_before, balances_before);
    let funded_after_mark = context.escrow_client.get_escrow(&funded_id);
    assert_eq!(
        context.escrow_client.get_escrow(&submitted_id),
        submitted_before
    );

    assert_mark_disputed_with_auth(
        &context,
        &context.freelancer,
        &context.freelancer,
        submitted_id,
        None,
    );
    assert_dispute_mark_changed_only_status(
        &context,
        submitted_id,
        &submitted_before,
        balances_before,
    );
    assert_eq!(
        context.escrow_client.get_escrow(&funded_id),
        funded_after_mark
    );
    assert_eq!(dispute_token_balances(&context), balances_before);
    assert_eq!(
        context.reputation_client.get_completion(&funded_id),
        funded_completion_before
    );
    assert_eq!(
        context.reputation_client.get_completion(&submitted_id),
        submitted_completion_before
    );
    assert_eq!(
        context
            .reputation_client
            .get_freelancer_stats(&context.freelancer),
        stats_before
    );
}

#[test]
fn c07_missing_escrow_mark_preserves_records_balances_and_reputation() {
    let context = setup();
    let existing_id = valid_dispute_entry_fixture(&context, TEscrowStatus::Funded, 242);
    let existing_before = context.escrow_client.get_escrow(&existing_id);
    let missing_id = context.escrow_client.get_next_escrow_id();
    let next_id_before = missing_id;
    let balances_before = dispute_token_balances(&context);
    let stats_before = context
        .reputation_client
        .get_freelancer_stats(&context.freelancer);
    let completion_before = context.reputation_client.get_completion(&existing_id);
    let missing_completion_before = context.reputation_client.get_completion(&missing_id);
    let dispute_events_before = dispute_event_count(&context);
    let transfer_events_before =
        events_from_topic(&context, &context.mock_usdc_token, "transfer").len();

    install_mock_dispute_auth(&context, &context.client, &context.client, missing_id);
    let result = context
        .escrow_client
        .try_mark_disputed(&context.client, &missing_id);

    assert_eq!(result, Err(Ok(Error::EscrowNotFound)));
    assert_eq!(dispute_event_count(&context), dispute_events_before);
    assert_eq!(
        events_from_topic(&context, &context.mock_usdc_token, "transfer").len(),
        transfer_events_before
    );
    assert_eq!(
        context.escrow_client.get_escrow(&existing_id),
        existing_before
    );
    assert_eq!(dispute_token_balances(&context), balances_before);
    assert_eq!(
        context.reputation_client.get_completion(&existing_id),
        completion_before
    );
    assert_eq!(
        context.reputation_client.get_completion(&missing_id),
        missing_completion_before
    );
    assert_eq!(
        context
            .reputation_client
            .get_freelancer_stats(&context.freelancer),
        stats_before
    );
    assert_eq!(context.escrow_client.get_next_escrow_id(), next_id_before);
}

#[test]
fn mark_disputed_requires_host_authorization_for_each_role_and_valid_status() {
    let context = setup();

    for (status_index, status) in [TEscrowStatus::Funded, TEscrowStatus::Submitted]
        .into_iter()
        .enumerate()
    {
        for caller in [
            &context.client,
            &context.freelancer,
            &context.platform_admin,
        ] {
            let missing_auth_id = valid_dispute_entry_fixture(
                &context,
                status.clone(),
                46 + (status_index as u8 * 10),
            );
            let missing_auth_before = context.escrow_client.get_escrow(&missing_auth_id);
            let missing_auth_balances = dispute_token_balances(&context);
            let missing_auth_event_count = dispute_event_count(&context);

            context.env.set_auths(&[]);
            let missing_auth = context
                .escrow_client
                .try_mark_disputed(caller, &missing_auth_id);
            assert_eq!(missing_auth, Err(Err(InvokeError::Abort)));
            context.env.mock_all_auths();
            assert_eq!(dispute_event_count(&context), missing_auth_event_count);
            assert_dispute_attempt_preserved_state(
                &context,
                missing_auth_id,
                &missing_auth_before,
                missing_auth_balances,
            );

            let mismatched_auth_id = valid_dispute_entry_fixture(
                &context,
                status.clone(),
                51 + (status_index as u8 * 10),
            );
            let mismatched_auth_before = context.escrow_client.get_escrow(&mismatched_auth_id);
            let mismatched_auth_balances = dispute_token_balances(&context);
            let mismatched_auth_event_count = dispute_event_count(&context);
            install_mock_dispute_auth(&context, &context.outsider, caller, mismatched_auth_id);
            let mismatched_auth = context
                .escrow_client
                .try_mark_disputed(caller, &mismatched_auth_id);
            assert_eq!(mismatched_auth, Err(Err(InvokeError::Abort)));
            context.env.mock_all_auths();
            assert_eq!(dispute_event_count(&context), mismatched_auth_event_count);
            assert_dispute_attempt_preserved_state(
                &context,
                mismatched_auth_id,
                &mismatched_auth_before,
                mismatched_auth_balances,
            );
        }
    }
}

#[test]
fn c13_mark_authorization_is_bound_to_the_escrow_id() {
    let context = setup();
    let first_id = valid_dispute_entry_fixture(&context, TEscrowStatus::Funded, 228);
    let second_id = valid_dispute_entry_fixture(&context, TEscrowStatus::Funded, 229);
    let first_before = context.escrow_client.get_escrow(&first_id);
    let second_before = context.escrow_client.get_escrow(&second_id);
    let balances_before = dispute_token_balances(&context);
    let completion_before = [
        context.reputation_client.get_completion(&first_id),
        context.reputation_client.get_completion(&second_id),
    ];
    let stats_before = context
        .reputation_client
        .get_freelancer_stats(&context.freelancer);
    let event_count_before = dispute_event_count(&context);
    let transfer_count_before =
        events_from_topic(&context, &context.mock_usdc_token, "transfer").len();

    install_mock_dispute_auth(&context, &context.client, &context.client, first_id);
    let result = context
        .escrow_client
        .try_mark_disputed(&context.client, &second_id);

    assert_eq!(result, Err(Err(InvokeError::Abort)));
    context.env.mock_all_auths();
    assert_eq!(dispute_event_count(&context), event_count_before);
    assert_eq!(
        events_from_topic(&context, &context.mock_usdc_token, "transfer").len(),
        transfer_count_before
    );
    assert_eq!(context.escrow_client.get_escrow(&first_id), first_before);
    assert_eq!(context.escrow_client.get_escrow(&second_id), second_before);
    assert_eq!(dispute_token_balances(&context), balances_before);
    assert_eq!(
        context.reputation_client.get_completion(&first_id),
        completion_before[0]
    );
    assert_eq!(
        context.reputation_client.get_completion(&second_id),
        completion_before[1]
    );
    assert_eq!(
        context
            .reputation_client
            .get_freelancer_stats(&context.freelancer),
        stats_before
    );
}

fn assert_c13_resolve_auth_rejected(
    context: &TTestContext,
    signer: Option<&Address>,
    authorized_actor: &Address,
    authorized_escrow_id: u64,
    authorized_share_bps: u32,
    authorized_hash_byte: u8,
    attempted_actor: &Address,
    attempted_escrow_id: u64,
    attempted_share_bps: u32,
    attempted_hash_byte: u8,
) {
    let first_id = authorized_escrow_id;
    let second_id = attempted_escrow_id;
    let first_before = context.escrow_client.get_escrow(&first_id);
    let second_before = context.escrow_client.get_escrow(&second_id);
    let balances_before = dispute_token_balances(context);
    let first_completion_before = context.reputation_client.get_completion(&first_id);
    let second_completion_before = context.reputation_client.get_completion(&second_id);
    let stats_before = context
        .reputation_client
        .get_freelancer_stats(&context.freelancer);
    let event_count_before = dispute_event_count(context);
    let transfer_count_before =
        events_from_topic(context, &context.mock_usdc_token, "transfer").len();
    let attempted_hash = hash_from_byte(&context.env, attempted_hash_byte);

    let result = if let Some(signer) = signer {
        install_mock_resolve_auth(
            context,
            signer,
            authorized_actor,
            authorized_escrow_id,
            authorized_share_bps,
            authorized_hash_byte,
        );
        context.escrow_client.try_resolve_dispute(
            attempted_actor,
            &attempted_escrow_id,
            &attempted_share_bps,
            &attempted_hash,
        )
    } else {
        context.escrow_client.mock_auths(&[]).try_resolve_dispute(
            attempted_actor,
            &attempted_escrow_id,
            &attempted_share_bps,
            &attempted_hash,
        )
    };

    assert_eq!(result, Err(Err(InvokeError::Abort)));
    context.env.mock_all_auths();
    assert_eq!(dispute_event_count(context), event_count_before);
    assert_eq!(
        events_from_topic(context, &context.mock_usdc_token, "transfer").len(),
        transfer_count_before
    );
    assert_eq!(context.escrow_client.get_escrow(&first_id), first_before);
    assert_eq!(context.escrow_client.get_escrow(&second_id), second_before);
    assert_eq!(dispute_token_balances(context), balances_before);
    assert_eq!(
        context.reputation_client.get_completion(&first_id),
        first_completion_before
    );
    assert_eq!(
        context.reputation_client.get_completion(&second_id),
        second_completion_before
    );
    assert_eq!(
        context
            .reputation_client
            .get_freelancer_stats(&context.freelancer),
        stats_before
    );
}

#[test]
fn c13_resolve_authorization_is_bound_to_signer_and_all_arguments() {
    let context = setup();
    let moderator = Address::generate(&context.env);
    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);
    let first_id = disputed_escrow_fixture(&context, TEscrowStatus::Funded, 301, 232);
    let second_id = disputed_escrow_fixture(&context, TEscrowStatus::Submitted, 301, 233);

    // No signer authorization and a different signer both abort at the host boundary.
    assert_c13_resolve_auth_rejected(
        &context, None, &moderator, first_id, 3_333, 234, &moderator, first_id, 3_333, 234,
    );
    assert_c13_resolve_auth_rejected(
        &context,
        Some(&context.outsider),
        &moderator,
        first_id,
        3_333,
        234,
        &moderator,
        first_id,
        3_333,
        234,
    );

    // Each authorized invocation is tied to the full contract call, not just its actor.
    assert_c13_resolve_auth_rejected(
        &context,
        Some(&moderator),
        &moderator,
        first_id,
        3_333,
        234,
        &moderator,
        second_id,
        3_333,
        234,
    );
    assert_c13_resolve_auth_rejected(
        &context,
        Some(&moderator),
        &moderator,
        first_id,
        3_333,
        234,
        &moderator,
        first_id,
        3_334,
        234,
    );
    assert_c13_resolve_auth_rejected(
        &context,
        Some(&moderator),
        &moderator,
        first_id,
        3_333,
        234,
        &moderator,
        first_id,
        3_333,
        235,
    );
}

fn assert_c13_terminal_retry_preserves_state(
    context: &TTestContext,
    escrow_id: u64,
    before: &TEscrow,
    balances_before: DisputeTokenBalances,
    completion_before: &Option<TCompletionRecord>,
    stats_before: &TFreelancerStatsView,
    unrelated_id: u64,
    unrelated_before: &TEscrow,
) {
    assert_dispute_attempt_preserved_state(context, escrow_id, before, balances_before);
    assert_eq!(
        context.reputation_client.get_completion(&escrow_id),
        completion_before.clone()
    );
    assert_eq!(
        context
            .reputation_client
            .get_freelancer_stats(&context.freelancer),
        stats_before.clone()
    );
    assert_eq!(
        context.escrow_client.get_escrow(&unrelated_id),
        unrelated_before.clone()
    );
}

#[test]
fn c13_settlement_emits_one_terminal_outcome_and_rejects_all_retries() {
    for (origin_index, origin) in [TEscrowStatus::Funded, TEscrowStatus::Submitted]
        .into_iter()
        .enumerate()
    {
        for (actor_index, registered_admin) in [false, true].into_iter().enumerate() {
            for share_bps in [0, 3_333, 10_000] {
                let context = setup();
                let moderator = Address::generate(&context.env);
                context
                    .escrow_client
                    .add_dispute_admin(&context.platform_admin, &moderator);
                let actor = if registered_admin {
                    moderator.clone()
                } else {
                    context.platform_admin.clone()
                };
                let fixture_hash = 150 + (origin_index * 10 + actor_index) as u8;
                let escrow_id =
                    disputed_escrow_fixture(&context, origin.clone(), 301, fixture_hash);
                let unrelated_id = funded_escrow_fixture(
                    &context,
                    101,
                    fixture_hash + 30,
                    u64::from(fixture_hash) + 31,
                    u64::from(fixture_hash) + 32,
                );
                let unrelated_before = context.escrow_client.get_escrow(&unrelated_id);
                let completion_before = context.reputation_client.get_completion(&escrow_id);
                let stats_before = context
                    .reputation_client
                    .get_freelancer_stats(&context.freelancer);
                let hash_byte = fixture_hash + 1;

                set_timestamp(&context.env, 500);
                let event_status = assert_resolve_dispute_with_auth(
                    &context, &actor, &actor, escrow_id, share_bps, hash_byte, None,
                )
                .unwrap();
                let expected_status = if share_bps == 0 {
                    TEscrowStatus::Cancelled
                } else {
                    TEscrowStatus::Released
                };
                let terminal_record = context.escrow_client.get_escrow(&escrow_id);
                assert_eq!(terminal_record.status, expected_status);
                assert_eq!(event_status, terminal_record.status);
                assert_eq!(
                    terminal_record.released_at,
                    if share_bps > 0 { 500 } else { 0 }
                );
                assert_eq!(
                    context.escrow_client.get_escrow(&unrelated_id),
                    unrelated_before
                );
                assert_eq!(
                    context.reputation_client.get_completion(&escrow_id),
                    completion_before
                );
                assert_eq!(
                    context
                        .reputation_client
                        .get_freelancer_stats(&context.freelancer),
                    stats_before
                );

                let balances_after_settlement = dispute_token_balances(&context);
                let completion_after_settlement =
                    context.reputation_client.get_completion(&escrow_id);
                let stats_after_settlement = context
                    .reputation_client
                    .get_freelancer_stats(&context.freelancer);

                for (retry_index, (retry_share_bps, retry_hash_byte)) in [
                    (share_bps, hash_byte),
                    (if share_bps == 3_333 { 3_334 } else { 3_333 }, hash_byte),
                    (share_bps, hash_byte + 1),
                ]
                .into_iter()
                .enumerate()
                {
                    set_timestamp(&context.env, 600 + retry_index as u64 * 100);
                    assert_resolve_dispute_with_auth(
                        &context,
                        &actor,
                        &actor,
                        escrow_id,
                        retry_share_bps,
                        retry_hash_byte,
                        Some(Error::InvalidStatus),
                    );
                    assert_c13_terminal_retry_preserves_state(
                        &context,
                        escrow_id,
                        &terminal_record,
                        balances_after_settlement,
                        &completion_after_settlement,
                        &stats_after_settlement,
                        unrelated_id,
                        &unrelated_before,
                    );
                }

                set_timestamp(&context.env, 1_000);
                let dispute_events_before = dispute_event_count(&context);
                let transfer_count_before =
                    events_from_topic(&context, &context.mock_usdc_token, "transfer").len();
                install_mock_dispute_auth(
                    &context,
                    &context.platform_admin,
                    &context.platform_admin,
                    escrow_id,
                );
                let mark_result = context
                    .escrow_client
                    .try_mark_disputed(&context.platform_admin, &escrow_id);
                assert_eq!(mark_result, Err(Ok(Error::InvalidStatus)));
                assert_eq!(dispute_event_count(&context), dispute_events_before);
                assert_eq!(
                    events_from_topic(&context, &context.mock_usdc_token, "transfer").len(),
                    transfer_count_before
                );
                context.env.mock_all_auths();
                assert_c13_terminal_retry_preserves_state(
                    &context,
                    escrow_id,
                    &terminal_record,
                    balances_after_settlement,
                    &completion_after_settlement,
                    &stats_after_settlement,
                    unrelated_id,
                    &unrelated_before,
                );
            }
        }
    }
}

#[test]
fn authenticated_outsider_cannot_mark_funded_or_submitted_escrows_disputed() {
    let context = setup();

    for (index, status) in [TEscrowStatus::Funded, TEscrowStatus::Submitted]
        .into_iter()
        .enumerate()
    {
        let escrow_id = valid_dispute_entry_fixture(&context, status, 60 + index as u8);
        let before = context.escrow_client.get_escrow(&escrow_id);
        let balances_before = dispute_token_balances(&context);
        assert_mark_disputed_with_auth(
            &context,
            &context.outsider,
            &context.outsider,
            escrow_id,
            Some(Error::Unauthorized),
        );
        assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
    }
}

#[test]
fn mark_disputed_rejects_every_permitted_role_for_invalid_statuses() {
    let context = setup();

    context.env.mock_all_auths();
    let created_id = create_escrow(&context, 190, 70);

    context.env.mock_all_auths();
    let released_id = submitted_escrow_fixture(&context, 390, 71, 4, 5, 6);
    context.escrow_client.approve_and_release(
        &context.client,
        &released_id,
        &5,
        &hash_from_byte(&context.env, 72),
    );

    context.env.mock_all_auths();
    let cancelled_id = create_escrow(&context, 500, 73);
    context
        .escrow_client
        .cancel_escrow(&context.client, &cancelled_id);

    context.env.mock_all_auths();
    let disputed_id = funded_escrow_fixture(&context, 510, 74, 7, 8);
    context
        .escrow_client
        .mark_disputed(&context.client, &disputed_id);

    for escrow_id in [created_id, released_id, cancelled_id, disputed_id] {
        let before = context.escrow_client.get_escrow(&escrow_id);
        let balances_before = dispute_token_balances(&context);
        for caller in [
            &context.client,
            &context.freelancer,
            &context.platform_admin,
        ] {
            assert_mark_disputed_with_auth(
                &context,
                caller,
                caller,
                escrow_id,
                Some(Error::InvalidStatus),
            );
            assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
        }
    }
}

#[test]
fn resolve_dispute_refunds_client_for_zero_share() {
    for (index, initial_status) in [TEscrowStatus::Funded, TEscrowStatus::Submitted]
        .into_iter()
        .enumerate()
    {
        let context = setup();
        let hash_byte = 66 + index as u8 * 2;
        let original_amount = 450;
        let escrow_id =
            disputed_escrow_fixture(&context, initial_status, original_amount, hash_byte);
        let before = context.escrow_client.get_escrow(&escrow_id);
        let balances_before = dispute_token_balances(&context);

        assert_resolve_dispute_with_auth(
            &context,
            &context.platform_admin,
            &context.platform_admin,
            escrow_id,
            0,
            hash_byte + 1,
            None,
        );

        let mut expected = before;
        expected.status = TEscrowStatus::Cancelled;
        assert_eq!(context.escrow_client.get_escrow(&escrow_id), expected);
        assert_settlement_conservation(&context, balances_before, original_amount, 450, 0);
    }
}

#[test]
fn dispute_admin_membership_is_owner_managed_and_idempotent() {
    let context = setup();
    let moderator = Address::generate(&context.env);

    assert!(context
        .escrow_client
        .is_dispute_admin(&context.platform_admin));
    assert!(!context.escrow_client.is_dispute_admin(&moderator));

    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);
    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);
    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &context.platform_admin);

    assert!(context.escrow_client.is_dispute_admin(&moderator));
    assert!(context
        .escrow_client
        .is_dispute_admin(&context.platform_admin));

    context
        .escrow_client
        .remove_dispute_admin(&context.platform_admin, &moderator);
    context
        .escrow_client
        .remove_dispute_admin(&context.platform_admin, &moderator);
    context
        .escrow_client
        .remove_dispute_admin(&context.platform_admin, &context.platform_admin);

    assert!(!context.escrow_client.is_dispute_admin(&moderator));
    assert!(context
        .escrow_client
        .is_dispute_admin(&context.platform_admin));
}

#[test]
fn registered_dispute_admin_can_settle_and_unknown_actor_cannot() {
    let context = setup();
    let moderator = Address::generate(&context.env);
    let escrow_id = disputed_escrow_fixture(&context, TEscrowStatus::Funded, 100, 68);
    let before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = dispute_token_balances(&context);

    assert_resolve_dispute_with_auth(
        &context,
        &context.outsider,
        &context.outsider,
        escrow_id,
        5_000,
        69,
        Some(Error::Unauthorized),
    );
    assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);

    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);
    let before = context.escrow_client.get_escrow(&escrow_id);
    assert_resolve_dispute_with_auth(&context, &moderator, &moderator, escrow_id, 5_000, 70, None);

    let mut expected = before;
    expected.status = TEscrowStatus::Released;
    expected.released_at = context.env.ledger().timestamp();
    assert_eq!(context.escrow_client.get_escrow(&escrow_id), expected);
    assert_eq!(context.mock_usdc_client.balance(&context.freelancer), 50);
    assert_eq!(context.mock_usdc_client.balance(&context.client), 9_950);
}

#[test]
fn c06_revoked_dispute_admin_loses_settlement_authority_until_reregistered() {
    let context = setup();
    let moderator = Address::generate(&context.env);
    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);

    let escrow_id = disputed_escrow_fixture(&context, TEscrowStatus::Funded, 301, 110);
    let before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = dispute_token_balances(&context);

    context
        .escrow_client
        .remove_dispute_admin(&context.platform_admin, &moderator);
    assert!(!context.escrow_client.is_dispute_admin(&moderator));
    assert_resolve_dispute_with_auth(
        &context,
        &moderator,
        &moderator,
        escrow_id,
        5_000,
        111,
        Some(Error::Unauthorized),
    );
    assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);

    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);
    assert!(context.escrow_client.is_dispute_admin(&moderator));
    let settlement_timestamp = 12_345;
    set_timestamp(&context.env, settlement_timestamp);
    let before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = dispute_token_balances(&context);
    assert_resolve_dispute_with_auth(
        &context, &moderator, &moderator, escrow_id, 5_000, 112, None,
    );

    let mut expected = before;
    expected.status = TEscrowStatus::Released;
    expected.released_at = settlement_timestamp;
    assert_eq!(context.escrow_client.get_escrow(&escrow_id), expected);
    assert_settlement_conservation(&context, balances_before, 301, 151, 150);
}

#[test]
fn dispute_admin_actor_cannot_settle_as_an_escrow_participant() {
    let context = setup();
    let moderator = Address::generate(&context.env);
    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);

    let client_escrow_id = context.escrow_client.create_escrow(
        &context.platform_admin,
        &moderator,
        &context.mock_usdc_token,
        &100,
        &hash_from_byte(&context.env, 72),
    );
    token::StellarAssetClient::new(&context.env, &context.mock_usdc_token)
        .mint(&context.platform_admin, &100);
    context
        .escrow_client
        .fund_escrow(&context.platform_admin, &client_escrow_id);
    context
        .escrow_client
        .mark_disputed(&context.platform_admin, &client_escrow_id);

    let owner_before = context.escrow_client.get_escrow(&client_escrow_id);
    let owner_balances = dispute_token_balances_for(&context, &context.platform_admin, &moderator);
    assert_resolve_dispute_with_auth(
        &context,
        &context.platform_admin,
        &context.platform_admin,
        client_escrow_id,
        5_000,
        73,
        Some(Error::Unauthorized),
    );
    assert_dispute_attempt_preserved_state_for(
        &context,
        client_escrow_id,
        &owner_before,
        &context.platform_admin,
        &moderator,
        owner_balances,
    );

    let moderator_escrow_id = context.escrow_client.create_escrow(
        &context.client,
        &moderator,
        &context.mock_usdc_token,
        &100,
        &hash_from_byte(&context.env, 74),
    );
    fund_escrow(&context, moderator_escrow_id);
    context
        .escrow_client
        .mark_disputed(&context.client, &moderator_escrow_id);
    let moderator_before = context.escrow_client.get_escrow(&moderator_escrow_id);
    let moderator_balances = dispute_token_balances_for(&context, &context.client, &moderator);
    assert_resolve_dispute_with_auth(
        &context,
        &moderator,
        &moderator,
        moderator_escrow_id,
        5_000,
        75,
        Some(Error::Unauthorized),
    );
    assert_dispute_attempt_preserved_state_for(
        &context,
        moderator_escrow_id,
        &moderator_before,
        &context.client,
        &moderator,
        moderator_balances,
    );

    let owner_freelancer_escrow_id = context.escrow_client.create_escrow(
        &context.client,
        &context.platform_admin,
        &context.mock_usdc_token,
        &100,
        &hash_from_byte(&context.env, 113),
    );
    fund_escrow(&context, owner_freelancer_escrow_id);
    context
        .escrow_client
        .mark_disputed(&context.client, &owner_freelancer_escrow_id);
    let owner_freelancer_before = context
        .escrow_client
        .get_escrow(&owner_freelancer_escrow_id);
    let owner_freelancer_balances =
        dispute_token_balances_for(&context, &context.client, &context.platform_admin);
    assert_resolve_dispute_with_auth(
        &context,
        &context.platform_admin,
        &context.platform_admin,
        owner_freelancer_escrow_id,
        5_000,
        114,
        Some(Error::Unauthorized),
    );
    assert_dispute_attempt_preserved_state_for(
        &context,
        owner_freelancer_escrow_id,
        &owner_freelancer_before,
        &context.client,
        &context.platform_admin,
        owner_freelancer_balances,
    );

    let moderator_client_escrow_id = context.escrow_client.create_escrow(
        &moderator,
        &context.freelancer,
        &context.mock_usdc_token,
        &100,
        &hash_from_byte(&context.env, 115),
    );
    token::StellarAssetClient::new(&context.env, &context.mock_usdc_token).mint(&moderator, &100);
    context
        .escrow_client
        .fund_escrow(&moderator, &moderator_client_escrow_id);
    context
        .escrow_client
        .mark_disputed(&moderator, &moderator_client_escrow_id);
    let moderator_client_before = context
        .escrow_client
        .get_escrow(&moderator_client_escrow_id);
    let moderator_client_balances =
        dispute_token_balances_for(&context, &moderator, &context.freelancer);
    assert_resolve_dispute_with_auth(
        &context,
        &moderator,
        &moderator,
        moderator_client_escrow_id,
        5_000,
        116,
        Some(Error::Unauthorized),
    );
    assert_dispute_attempt_preserved_state_for(
        &context,
        moderator_client_escrow_id,
        &moderator_client_before,
        &moderator,
        &context.freelancer,
        moderator_client_balances,
    );
}

#[test]
fn c06_registered_dispute_admin_cannot_mark_funded_or_submitted_escrows() {
    let context = setup();
    let moderator = Address::generate(&context.env);
    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);

    for (index, status) in [TEscrowStatus::Funded, TEscrowStatus::Submitted]
        .into_iter()
        .enumerate()
    {
        let escrow_id = valid_dispute_entry_fixture(&context, status, 117 + index as u8);
        let before = context.escrow_client.get_escrow(&escrow_id);
        let balances_before = dispute_token_balances(&context);

        assert_mark_disputed_with_auth(
            &context,
            &moderator,
            &moderator,
            escrow_id,
            Some(Error::Unauthorized),
        );
        assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
    }
}

#[test]
fn resolve_dispute_requires_invocation_scoped_actor_authentication() {
    let context = setup();
    let moderator = Address::generate(&context.env);
    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);
    let escrow_id = disputed_escrow_fixture(&context, TEscrowStatus::Funded, 100, 76);
    let before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = dispute_token_balances(&context);
    let missing_auth_event_count = dispute_event_count(&context);

    let resolution_hash = hash_from_byte(&context.env, 77);
    let missing_auth = context.escrow_client.mock_auths(&[]).try_resolve_dispute(
        &moderator,
        &escrow_id,
        &5_000,
        &resolution_hash,
    );

    assert_eq!(missing_auth, Err(Err(InvokeError::Abort)));
    context.env.mock_all_auths();
    assert_eq!(dispute_event_count(&context), missing_auth_event_count);
    assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);

    let wrong_actor_event_count = dispute_event_count(&context);
    install_mock_resolve_auth(
        &context,
        &context.outsider,
        &moderator,
        escrow_id,
        5_000,
        78,
    );
    let wrong_actor_auth = context.escrow_client.try_resolve_dispute(
        &moderator,
        &escrow_id,
        &5_000,
        &hash_from_byte(&context.env, 78),
    );

    assert_eq!(wrong_actor_auth, Err(Err(InvokeError::Abort)));
    context.env.mock_all_auths();
    assert_eq!(dispute_event_count(&context), wrong_actor_event_count);
    assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
}

#[test]
fn resolve_dispute_releases_full_amount_to_freelancer_for_full_share() {
    for (index, initial_status) in [TEscrowStatus::Funded, TEscrowStatus::Submitted]
        .into_iter()
        .enumerate()
    {
        let context = setup();
        let hash_byte = 68 + index as u8 * 2;
        let original_amount = 520;
        let escrow_id =
            disputed_escrow_fixture(&context, initial_status, original_amount, hash_byte);
        let settlement_timestamp = 10_000 + index as u64;
        set_timestamp(&context.env, settlement_timestamp);
        let before = context.escrow_client.get_escrow(&escrow_id);
        let balances_before = dispute_token_balances(&context);

        assert_resolve_dispute_with_auth(
            &context,
            &context.platform_admin,
            &context.platform_admin,
            escrow_id,
            10_000,
            hash_byte + 1,
            None,
        );

        let mut expected = before;
        expected.status = TEscrowStatus::Released;
        expected.released_at = settlement_timestamp;
        assert_eq!(context.escrow_client.get_escrow(&escrow_id), expected);
        assert_settlement_conservation(&context, balances_before, original_amount, 0, 520);
    }
}

#[test]
fn resolve_dispute_splits_amount_with_remainder_to_client() {
    for (index, initial_status) in [TEscrowStatus::Funded, TEscrowStatus::Submitted]
        .into_iter()
        .enumerate()
    {
        let context = setup();
        let hash_byte = 70 + index as u8 * 2;
        let original_amount = 101;
        let escrow_id =
            disputed_escrow_fixture(&context, initial_status, original_amount, hash_byte);
        let settlement_timestamp = 10_000 + index as u64;
        set_timestamp(&context.env, settlement_timestamp);
        let before = context.escrow_client.get_escrow(&escrow_id);
        let balances_before = dispute_token_balances(&context);

        assert_resolve_dispute_with_auth(
            &context,
            &context.platform_admin,
            &context.platform_admin,
            escrow_id,
            3_333,
            hash_byte + 1,
            None,
        );

        let mut expected = before;
        expected.status = TEscrowStatus::Released;
        expected.released_at = settlement_timestamp;
        assert_eq!(context.escrow_client.get_escrow(&escrow_id), expected);
        assert_settlement_conservation(&context, balances_before, original_amount, 68, 33);
    }
}

#[test]
fn c06_dispute_settlement_boundary_shares_are_released_for_both_admin_roles_and_origins() {
    let mut scenario = 0_u8;

    for registered_admin in [false, true] {
        for initial_status in [TEscrowStatus::Funded, TEscrowStatus::Submitted] {
            for freelancer_share_bps in [1_u32, 9_999] {
                let context = setup();
                let moderator = Address::generate(&context.env);
                if registered_admin {
                    context
                        .escrow_client
                        .add_dispute_admin(&context.platform_admin, &moderator);
                }
                let dispute_admin = if registered_admin {
                    &moderator
                } else {
                    &context.platform_admin
                };
                let hash_byte = 120 + scenario * 2;
                let escrow_id =
                    disputed_escrow_fixture(&context, initial_status.clone(), 301, hash_byte);
                let settlement_timestamp = 20_000 + u64::from(scenario);
                set_timestamp(&context.env, settlement_timestamp);
                let before = context.escrow_client.get_escrow(&escrow_id);
                let balances_before = dispute_token_balances(&context);

                assert_resolve_dispute_with_auth(
                    &context,
                    dispute_admin,
                    dispute_admin,
                    escrow_id,
                    freelancer_share_bps,
                    hash_byte + 1,
                    None,
                );

                let mut expected = before;
                expected.status = TEscrowStatus::Released;
                expected.released_at = settlement_timestamp;
                assert_eq!(context.escrow_client.get_escrow(&escrow_id), expected);
                let (expected_freelancer_gain, expected_client_gain) = if freelancer_share_bps == 1
                {
                    (0, 301)
                } else {
                    (300, 1)
                };
                assert_settlement_conservation(
                    &context,
                    balances_before,
                    301,
                    expected_client_gain,
                    expected_freelancer_gain,
                );
                scenario += 1;
            }
        }
    }
}

#[test]
fn failed_second_settlement_transfer_rolls_back_and_emits_no_resolution_event() {
    let context = setup();
    let failing_token_id = context.env.register(FailingToken, ());
    let failing_token = FailingTokenClient::new(&context.env, &failing_token_id);
    let amount = 101;
    failing_token.mint(&context.client, &amount);

    let escrow_id = context.escrow_client.create_escrow(
        &context.client,
        &context.freelancer,
        &failing_token_id,
        &amount,
        &hash_from_byte(&context.env, 96),
    );
    context
        .escrow_client
        .fund_escrow(&context.client, &escrow_id);
    assert_mark_disputed_with_auth(&context, &context.client, &context.client, escrow_id, None);

    failing_token.fail_for_recipient(&context.client);
    let escrow_before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = (
        failing_token.balance(&context.client),
        failing_token.balance(&context.freelancer),
        failing_token.balance(&context.escrow_contract_id),
    );
    let dispute_event_count_before = dispute_event_count(&context);
    let resolution_hash = hash_from_byte(&context.env, 97);

    let result = context.escrow_client.try_resolve_dispute(
        &context.platform_admin,
        &escrow_id,
        &3_333,
        &resolution_hash,
    );

    assert!(matches!(result, Err(Err(InvokeError::Abort))));
    assert_eq!(context.escrow_client.get_escrow(&escrow_id), escrow_before);
    assert_eq!(
        (
            failing_token.balance(&context.client),
            failing_token.balance(&context.freelancer),
            failing_token.balance(&context.escrow_contract_id),
        ),
        balances_before
    );
    assert_eq!(dispute_event_count(&context), dispute_event_count_before);
}

#[test]
fn resolve_dispute_rejects_unauthorized_admin() {
    let context = setup();

    let escrow_id = disputed_escrow_fixture(&context, TEscrowStatus::Funded, 300, 72);
    let before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = dispute_token_balances(&context);

    assert_resolve_dispute_with_auth(
        &context,
        &context.outsider,
        &context.outsider,
        escrow_id,
        5_000,
        73,
        Some(Error::Unauthorized),
    );
    assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
}

#[test]
fn resolve_dispute_rejects_invalid_basis_points_without_settlement() {
    let context = setup();
    let moderator = Address::generate(&context.env);
    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);
    let escrow_id = disputed_escrow_fixture(&context, TEscrowStatus::Funded, 300, 74);
    let before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = dispute_token_balances(&context);

    for (index, invalid_share) in [10_001, u32::MAX].into_iter().enumerate() {
        for (actor_index, actor) in [&context.platform_admin, &moderator]
            .into_iter()
            .enumerate()
        {
            assert_resolve_dispute_with_auth(
                &context,
                actor,
                actor,
                escrow_id,
                invalid_share,
                75 + (index * 2 + actor_index) as u8,
                Some(Error::InvalidShareBps),
            );
            assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
        }
    }
}

#[test]
fn resolve_dispute_rejects_non_disputed_statuses_and_repeat_settlement() {
    let context = setup();
    let moderator = Address::generate(&context.env);
    context
        .escrow_client
        .add_dispute_admin(&context.platform_admin, &moderator);

    for (index, status) in [
        TEscrowStatus::Created,
        TEscrowStatus::Funded,
        TEscrowStatus::Submitted,
        TEscrowStatus::Released,
        TEscrowStatus::Cancelled,
    ]
    .into_iter()
    .enumerate()
    {
        let escrow_id = escrow_fixture_with_status(&context, status, 80 + index as u8);
        let before = context.escrow_client.get_escrow(&escrow_id);
        let balances_before = dispute_token_balances(&context);

        for (actor_index, actor) in [&context.platform_admin, &moderator]
            .into_iter()
            .enumerate()
        {
            assert_resolve_dispute_with_auth(
                &context,
                actor,
                actor,
                escrow_id,
                5_000,
                85 + (index * 2 + actor_index) as u8,
                Some(Error::InvalidStatus),
            );
            assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
        }
    }

    let cancelled_id = disputed_escrow_fixture(&context, TEscrowStatus::Funded, 150, 90);
    assert_resolve_dispute_with_auth(
        &context,
        &context.platform_admin,
        &context.platform_admin,
        cancelled_id,
        0,
        91,
        None,
    );
    let cancelled_before = context.escrow_client.get_escrow(&cancelled_id);
    let cancelled_balances = dispute_token_balances(&context);
    for (index, actor) in [&context.platform_admin, &moderator]
        .into_iter()
        .enumerate()
    {
        assert_resolve_dispute_with_auth(
            &context,
            actor,
            actor,
            cancelled_id,
            0,
            92 + index as u8,
            Some(Error::InvalidStatus),
        );
        assert_dispute_attempt_preserved_state(
            &context,
            cancelled_id,
            &cancelled_before,
            cancelled_balances,
        );
    }

    let released_id = disputed_escrow_fixture(&context, TEscrowStatus::Submitted, 150, 93);
    assert_resolve_dispute_with_auth(
        &context,
        &context.platform_admin,
        &context.platform_admin,
        released_id,
        10_000,
        94,
        None,
    );
    let released_before = context.escrow_client.get_escrow(&released_id);
    let released_balances = dispute_token_balances(&context);
    for (index, actor) in [&context.platform_admin, &moderator]
        .into_iter()
        .enumerate()
    {
        assert_resolve_dispute_with_auth(
            &context,
            actor,
            actor,
            released_id,
            10_000,
            95 + index as u8,
            Some(Error::InvalidStatus),
        );
        assert_dispute_attempt_preserved_state(
            &context,
            released_id,
            &released_before,
            released_balances,
        );
    }
}

#[test]
fn get_escrow_returns_latest_state() {
    let context = setup();

    let escrow_id = create_escrow(&context, 777, 42);

    let created = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(created.status, TEscrowStatus::Created);

    fund_escrow(&context, escrow_id);
    let funded = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(funded.status, TEscrowStatus::Funded);

    submit_work(&context, escrow_id);
    let submitted = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(submitted.status, TEscrowStatus::Submitted);

    context.escrow_client.approve_and_release(
        &context.client,
        &escrow_id,
        &5,
        &hash_from_byte(&context.env, 43),
    );

    let released = context.escrow_client.get_escrow(&escrow_id);
    assert_eq!(released.status, TEscrowStatus::Released);
}

#[test]
fn helper_getters_return_expected_values() {
    let context = setup();

    assert_eq!(
        context.escrow_client.get_reputation_contract(),
        context.reputation_client.address
    );
    assert_eq!(
        context.escrow_client.get_platform_admin(),
        context.platform_admin
    );
    assert_eq!(context.escrow_client.get_next_escrow_id(), 1);

    create_escrow(&context, 111, 44);
    assert_eq!(context.escrow_client.get_next_escrow_id(), 2);
}

#[test]
fn fund_submitted_or_released_flow_is_rejected() {
    let context = setup();

    let escrow_id = create_escrow(&context, 510, 45);
    fund_escrow(&context, escrow_id);
    submit_work(&context, escrow_id);

    let from_submitted = context
        .escrow_client
        .try_fund_escrow(&context.client, &escrow_id);
    assert_eq!(from_submitted, Err(Ok(Error::InvalidStatus)));

    context.escrow_client.approve_and_release(
        &context.client,
        &escrow_id,
        &5,
        &hash_from_byte(&context.env, 46),
    );

    let from_released = context
        .escrow_client
        .try_fund_escrow(&context.client, &escrow_id);
    assert_eq!(from_released, Err(Ok(Error::InvalidStatus)));
}

#[test]
fn submit_after_dispute_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 610, 47);
    fund_escrow(&context, escrow_id);
    context
        .escrow_client
        .mark_disputed(&context.client, &escrow_id);

    let result = context.escrow_client.try_submit_work(
        &context.freelancer,
        &escrow_id,
        &hash_from_byte(&context.env, 42),
    );

    assert_eq!(result, Err(Ok(Error::InvalidStatus)));
}

#[test]
fn cancel_released_or_disputed_fails() {
    let context = setup();

    let released_id = create_escrow(&context, 300, 48);
    fund_escrow(&context, released_id);
    submit_work(&context, released_id);
    context.escrow_client.approve_and_release(
        &context.client,
        &released_id,
        &4,
        &hash_from_byte(&context.env, 49),
    );

    let cancel_released = context
        .escrow_client
        .try_cancel_escrow(&context.client, &released_id);
    assert_eq!(cancel_released, Err(Ok(Error::InvalidStatus)));

    let disputed_id = create_escrow(&context, 400, 50);
    fund_escrow(&context, disputed_id);
    context
        .escrow_client
        .mark_disputed(&context.client, &disputed_id);

    let cancel_disputed = context
        .escrow_client
        .try_cancel_escrow(&context.client, &disputed_id);
    assert_eq!(cancel_disputed, Err(Ok(Error::InvalidStatus)));
}

#[test]
fn setup_mints_test_funds_to_client() {
    let context = setup();

    assert_eq!(context.mock_usdc_client.balance(&context.client), 10_000);
}

#[test]
fn allowlist_is_optional_by_default() {
    let context = setup();

    assert_eq!(context.escrow_client.get_allowed_asset_count(), 0);

    let escrow_id = create_escrow(&context, 125, 52);
    let escrow = context.escrow_client.get_escrow(&escrow_id);

    assert_eq!(escrow.asset, context.mock_usdc_token);
}

#[test]
fn allowlist_rejects_non_allowed_assets_when_configured() {
    let context = setup();

    context
        .escrow_client
        .add_allowed_asset(&context.platform_admin, &context.mock_usdc_token);

    let other_asset_admin = Address::generate(&context.env);
    let other_asset_contract = context
        .env
        .register_stellar_asset_contract_v2(other_asset_admin);
    let other_asset = other_asset_contract.address();

    let result = context.escrow_client.try_create_escrow(
        &context.client,
        &context.freelancer,
        &other_asset,
        &200,
        &hash_from_byte(&context.env, 53),
    );

    assert_eq!(result, Err(Ok(Error::AssetNotAllowed)));
}

#[test]
fn platform_admin_can_allow_native_xlm_sac_asset() {
    let context = setup();

    context
        .escrow_client
        .add_allowed_asset(&context.platform_admin, &context.mock_xlm_token);

    assert_eq!(
        context
            .escrow_client
            .is_allowed_asset(&context.mock_xlm_token),
        true
    );
}

#[test]
fn xlm_sac_escrow_lifecycle_uses_token_transfer_semantics() {
    let context = setup();

    context
        .escrow_client
        .add_allowed_asset(&context.platform_admin, &context.mock_usdc_token);
    context
        .escrow_client
        .add_allowed_asset(&context.platform_admin, &context.mock_xlm_token);

    let escrow_id = context.escrow_client.create_escrow(
        &context.client,
        &context.freelancer,
        &context.mock_xlm_token,
        &1_500,
        &hash_from_byte(&context.env, 58),
    );
    context
        .escrow_client
        .fund_escrow(&context.client, &escrow_id);
    context.escrow_client.submit_work(
        &context.freelancer,
        &escrow_id,
        &hash_from_byte(&context.env, 42),
    );
    context.escrow_client.approve_and_release(
        &context.client,
        &escrow_id,
        &5,
        &hash_from_byte(&context.env, 59),
    );

    let escrow = context.escrow_client.get_escrow(&escrow_id);

    assert_eq!(escrow.asset, context.mock_xlm_token);
    assert_eq!(escrow.status, TEscrowStatus::Released);
    assert_eq!(context.mock_xlm_client.balance(&context.client), 18_500);
    assert_eq!(context.mock_xlm_client.balance(&context.freelancer), 1_500);
    assert_eq!(
        context.mock_xlm_client.balance(&context.escrow_contract_id),
        0
    );
}

#[test]
fn funded_xlm_sac_escrow_cancel_refunds_client() {
    let context = setup();

    context
        .escrow_client
        .add_allowed_asset(&context.platform_admin, &context.mock_xlm_token);

    let escrow_id = context.escrow_client.create_escrow(
        &context.client,
        &context.freelancer,
        &context.mock_xlm_token,
        &2_000,
        &hash_from_byte(&context.env, 60),
    );
    context
        .escrow_client
        .fund_escrow(&context.client, &escrow_id);
    context
        .escrow_client
        .cancel_escrow(&context.client, &escrow_id);

    let escrow = context.escrow_client.get_escrow(&escrow_id);

    assert_eq!(escrow.status, TEscrowStatus::Cancelled);
    assert_eq!(context.mock_xlm_client.balance(&context.client), 20_000);
    assert_eq!(
        context.mock_xlm_client.balance(&context.escrow_contract_id),
        0
    );
}

#[test]
fn removing_xlm_sac_from_allowlist_blocks_new_escrows() {
    let context = setup();

    context
        .escrow_client
        .add_allowed_asset(&context.platform_admin, &context.mock_xlm_token);
    context
        .escrow_client
        .remove_allowed_asset(&context.platform_admin, &context.mock_xlm_token);
    context
        .escrow_client
        .add_allowed_asset(&context.platform_admin, &context.mock_usdc_token);

    let result = context.escrow_client.try_create_escrow(
        &context.client,
        &context.freelancer,
        &context.mock_xlm_token,
        &500,
        &hash_from_byte(&context.env, 61),
    );

    assert_eq!(result, Err(Ok(Error::AssetNotAllowed)));
}

#[test]
fn allowlist_admin_management_works() {
    let context = setup();

    assert_eq!(
        context
            .escrow_client
            .is_allowed_asset(&context.mock_usdc_token),
        false
    );

    context
        .escrow_client
        .add_allowed_asset(&context.platform_admin, &context.mock_usdc_token);

    assert_eq!(
        context
            .escrow_client
            .is_allowed_asset(&context.mock_usdc_token),
        true
    );
    assert_eq!(context.escrow_client.get_allowed_asset_count(), 1);

    context
        .escrow_client
        .remove_allowed_asset(&context.platform_admin, &context.mock_usdc_token);

    assert_eq!(
        context
            .escrow_client
            .is_allowed_asset(&context.mock_usdc_token),
        false
    );
    assert_eq!(context.escrow_client.get_allowed_asset_count(), 0);
}

#[test]
fn allowlist_admin_management_rejects_unauthorized_caller() {
    let context = setup();

    let add_result = context
        .escrow_client
        .try_add_allowed_asset(&context.outsider, &context.mock_usdc_token);
    assert_eq!(add_result, Err(Ok(Error::Unauthorized)));

    context
        .escrow_client
        .add_allowed_asset(&context.platform_admin, &context.mock_usdc_token);

    let remove_result = context
        .escrow_client
        .try_remove_allowed_asset(&context.outsider, &context.mock_usdc_token);
    assert_eq!(remove_result, Err(Ok(Error::Unauthorized)));
}
