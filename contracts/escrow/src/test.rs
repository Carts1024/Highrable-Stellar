#![cfg(test)]

extern crate std;

use super::{Error, EscrowContract, EscrowContractClient, TEscrow, TEscrowStatus};
use highrable_reputation::{ReputationContract, ReputationContractClient, TFreelancerStatsView};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, BytesN, Env,
};
use std::boxed::Box;

struct TTestContext {
    env: Env,
    escrow_client: EscrowContractClient<'static>,
    reputation_client: ReputationContractClient<'static>,
    mock_usdc_client: token::Client<'static>,
    escrow_contract_id: Address,
    platform_admin: Address,
    client: Address,
    freelancer: Address,
    outsider: Address,
    mock_usdc_token: Address,
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

    let reputation_contract_id = env.register(ReputationContract, ());
    let escrow_contract_id = env.register(EscrowContract, ());

    let env_ref: &'static Env = Box::leak(Box::new(env));

    let reputation_client = ReputationContractClient::new(env_ref, &reputation_contract_id);
    let escrow_client = EscrowContractClient::new(env_ref, &escrow_contract_id);

    reputation_client.initialize(&escrow_contract_id);
    escrow_client.initialize(&reputation_contract_id, &platform_admin);

    let token_admin_client = token::StellarAssetClient::new(env_ref, &mock_usdc_token);
    token_admin_client.mint(&client, &10_000);

    TTestContext {
        env: env_ref.clone(),
        escrow_client,
        reputation_client,
        mock_usdc_client: token::Client::new(env_ref, &mock_usdc_token),
        escrow_contract_id,
        platform_admin,
        client,
        freelancer,
        outsider,
        mock_usdc_token,
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

fn submit_work(context: &TTestContext, escrow_id: u64) {
    context
        .escrow_client
        .submit_work(&context.freelancer, &escrow_id);
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

    let first_escrow: TEscrow = context
        .escrow_client
        .get_escrow(&first_milestone_escrow_id);
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

    let submit = context
        .escrow_client
        .try_submit_work(&context.freelancer, &escrow_id);
    assert_eq!(submit, Err(Ok(Error::InvalidFreelancer)));

    let release = context.escrow_client.try_approve_and_release(
        &context.client,
        &escrow_id,
        &5,
        &hash_from_byte(&context.env, 60),
    );
    assert_eq!(release, Err(Ok(Error::InvalidStatus)));

    let dispute_by_freelancer = context
        .escrow_client
        .try_mark_disputed(&context.freelancer, &escrow_id);
    assert_eq!(dispute_by_freelancer, Err(Ok(Error::InvalidFreelancer)));
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
}

#[test]
fn unauthorized_submit_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 220, 10);
    fund_escrow(&context, escrow_id);

    let result = context
        .escrow_client
        .try_submit_work(&context.outsider, &escrow_id);

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn submit_wrong_status_fails() {
    let context = setup();

    let created_escrow_id = create_escrow(&context, 220, 11);
    let before_funding = context
        .escrow_client
        .try_submit_work(&context.freelancer, &created_escrow_id);
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

    let after_release = context
        .escrow_client
        .try_submit_work(&context.freelancer, &escrow_id);
    assert_eq!(after_release, Err(Ok(Error::InvalidStatus)));

    let cancelled_escrow_id = create_escrow(&context, 330, 14);
    context
        .escrow_client
        .cancel_escrow(&context.client, &cancelled_escrow_id);

    let after_cancel = context
        .escrow_client
        .try_submit_work(&context.freelancer, &cancelled_escrow_id);
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
fn mark_disputed_works() {
    let context = setup();

    let funded_escrow_id = create_escrow(&context, 150, 34);
    fund_escrow(&context, funded_escrow_id);
    context
        .escrow_client
        .mark_disputed(&context.client, &funded_escrow_id);

    let funded_escrow = context.escrow_client.get_escrow(&funded_escrow_id);
    assert_eq!(funded_escrow.status, TEscrowStatus::Disputed);

    let submitted_escrow_id = create_escrow(&context, 150, 35);
    fund_escrow(&context, submitted_escrow_id);
    submit_work(&context, submitted_escrow_id);
    context
        .escrow_client
        .mark_disputed(&context.freelancer, &submitted_escrow_id);

    let submitted_escrow = context.escrow_client.get_escrow(&submitted_escrow_id);
    assert_eq!(submitted_escrow.status, TEscrowStatus::Disputed);
}

#[test]
fn unauthorized_dispute_fails() {
    let context = setup();

    let escrow_id = create_escrow(&context, 460, 36);
    fund_escrow(&context, escrow_id);

    let random_wallet = Address::generate(&context.env);
    let result = context
        .escrow_client
        .try_mark_disputed(&random_wallet, &escrow_id);

    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn dispute_wrong_status_fails() {
    let context = setup();

    let created_id = create_escrow(&context, 190, 37);
    let created = context
        .escrow_client
        .try_mark_disputed(&context.client, &created_id);
    assert_eq!(created, Err(Ok(Error::InvalidStatus)));

    let released_id = create_escrow(&context, 390, 38);
    fund_escrow(&context, released_id);
    submit_work(&context, released_id);
    context.escrow_client.approve_and_release(
        &context.client,
        &released_id,
        &5,
        &hash_from_byte(&context.env, 39),
    );

    let released = context
        .escrow_client
        .try_mark_disputed(&context.client, &released_id);
    assert_eq!(released, Err(Ok(Error::InvalidStatus)));

    let cancelled_id = create_escrow(&context, 500, 40);
    context
        .escrow_client
        .cancel_escrow(&context.client, &cancelled_id);

    let cancelled = context
        .escrow_client
        .try_mark_disputed(&context.client, &cancelled_id);
    assert_eq!(cancelled, Err(Ok(Error::InvalidStatus)));

    let disputed_id = create_escrow(&context, 510, 41);
    fund_escrow(&context, disputed_id);
    context
        .escrow_client
        .mark_disputed(&context.client, &disputed_id);

    let already_disputed = context
        .escrow_client
        .try_mark_disputed(&context.client, &disputed_id);
    assert_eq!(already_disputed, Err(Ok(Error::InvalidStatus)));
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

    let result = context
        .escrow_client
        .try_submit_work(&context.freelancer, &escrow_id);

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
