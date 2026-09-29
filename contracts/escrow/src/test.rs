#![cfg(test)]

extern crate std;

use super::{Error, EscrowContract, EscrowContractClient, TEscrow, TEscrowStatus};
use highrable_reputation::{ReputationContract, ReputationContractClient, TFreelancerStatsView};
use soroban_sdk::{
    testutils::{
        Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger, MockAuth, MockAuthInvoke,
    },
    token, Address, BytesN, Env, IntoVal, InvokeError, Symbol,
};
use std::boxed::Box;

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
    install_mock_dispute_auth(context, authorized_address, caller, escrow_id);
    let result = context.escrow_client.try_mark_disputed(caller, &escrow_id);

    match expected_error {
        Some(error) => assert_eq!(result, Err(Ok(error))),
        None => {
            assert_dispute_auth(context, authorized_address, caller, escrow_id);
            assert_eq!(result, Ok(Ok(())));
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
) {
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

    match expected_error {
        Some(error) => assert_eq!(result, Err(Ok(error))),
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
        }
    }
    context.env.mock_all_auths();
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

            context.env.set_auths(&[]);
            let missing_auth = context
                .escrow_client
                .try_mark_disputed(caller, &missing_auth_id);
            assert_eq!(missing_auth, Err(Err(InvokeError::Abort)));
            context.env.mock_all_auths();
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
            install_mock_dispute_auth(&context, &context.outsider, caller, mismatched_auth_id);
            let mismatched_auth = context
                .escrow_client
                .try_mark_disputed(caller, &mismatched_auth_id);
            assert_eq!(mismatched_auth, Err(Err(InvokeError::Abort)));
            context.env.mock_all_auths();
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

    let resolution_hash = hash_from_byte(&context.env, 77);
    let missing_auth = context.escrow_client.mock_auths(&[]).try_resolve_dispute(
        &moderator,
        &escrow_id,
        &5_000,
        &resolution_hash,
    );

    assert_eq!(missing_auth, Err(Err(InvokeError::Abort)));
    context.env.mock_all_auths();
    assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);

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
    let escrow_id = disputed_escrow_fixture(&context, TEscrowStatus::Funded, 300, 74);
    let before = context.escrow_client.get_escrow(&escrow_id);
    let balances_before = dispute_token_balances(&context);

    for (index, invalid_share) in [10_001, u32::MAX].into_iter().enumerate() {
        assert_resolve_dispute_with_auth(
            &context,
            &context.platform_admin,
            &context.platform_admin,
            escrow_id,
            invalid_share,
            75 + index as u8,
            Some(Error::InvalidShareBps),
        );
        assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
    }
}

#[test]
fn resolve_dispute_rejects_non_disputed_statuses_and_repeat_settlement() {
    let context = setup();

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

        assert_resolve_dispute_with_auth(
            &context,
            &context.platform_admin,
            &context.platform_admin,
            escrow_id,
            5_000,
            85 + index as u8,
            Some(Error::InvalidStatus),
        );
        assert_dispute_attempt_preserved_state(&context, escrow_id, &before, balances_before);
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
    assert_resolve_dispute_with_auth(
        &context,
        &context.platform_admin,
        &context.platform_admin,
        cancelled_id,
        0,
        92,
        Some(Error::InvalidStatus),
    );
    assert_dispute_attempt_preserved_state(
        &context,
        cancelled_id,
        &cancelled_before,
        cancelled_balances,
    );

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
    assert_resolve_dispute_with_auth(
        &context,
        &context.platform_admin,
        &context.platform_admin,
        released_id,
        10_000,
        95,
        Some(Error::InvalidStatus),
    );
    assert_dispute_attempt_preserved_state(
        &context,
        released_id,
        &released_before,
        released_balances,
    );
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
