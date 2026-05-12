#![cfg(test)]

extern crate std;

use super::{
    ReputationContract, ReputationContractClient, TCompletionRecord, TFreelancerStatsView,
};
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, BytesN, Env, IntoVal,
};
use std::{boxed::Box, panic};

struct TestContext {
    env: Env,
    client: ReputationContractClient<'static>,
    contract_id: Address,
    authorized_escrow_contract: Address,
    random_wallet: Address,
    client_address: Address,
    freelancer_a: Address,
    freelancer_b: Address,
    asset: Address,
}

fn setup() -> TestContext {
    let env = Env::default();

    let authorized_escrow_contract = Address::generate(&env);
    let random_wallet = Address::generate(&env);
    let client_address = Address::generate(&env);
    let freelancer_a = Address::generate(&env);
    let freelancer_b = Address::generate(&env);
    let asset = Address::generate(&env);

    let contract_id = env.register(ReputationContract, ());

    let env_ref: &'static Env = Box::leak(Box::new(env));
    let client = ReputationContractClient::new(env_ref, &contract_id);

    TestContext {
        env: env_ref.clone(),
        client,
        contract_id,
        authorized_escrow_contract,
        random_wallet,
        client_address,
        freelancer_a,
        freelancer_b,
        asset,
    }
}

fn hash_from_byte(env: &Env, value: u8) -> BytesN<32> {
    BytesN::from_array(env, &[value; 32])
}

#[allow(clippy::too_many_arguments)]
fn record_completion_as_authorized(
    context: &TestContext,
    escrow_id: u64,
    client: &Address,
    freelancer: &Address,
    asset: &Address,
    amount: i128,
    job_hash: &BytesN<32>,
    rating: u32,
    review_hash: &BytesN<32>,
) -> bool {
    let args = (
        escrow_id,
        client.clone(),
        freelancer.clone(),
        asset.clone(),
        amount,
        job_hash.clone(),
        rating,
        review_hash.clone(),
    )
        .into_val(&context.env);

    context
        .client
        .mock_auths(&[MockAuth {
            address: &context.authorized_escrow_contract,
            invoke: &MockAuthInvoke {
                contract: &context.contract_id,
                fn_name: "record_completion",
                args,
                sub_invokes: &[],
            },
        }])
        .record_completion(
            &escrow_id,
            client,
            freelancer,
            asset,
            &amount,
            job_hash,
            &rating,
            review_hash,
        )
}

fn assert_panics<T>(f: impl FnOnce() -> T) {
    assert!(panic::catch_unwind(panic::AssertUnwindSafe(f)).is_err());
}

#[test]
fn initialize_works() {
    let context = setup();

    assert_eq!(context.client.is_initialized(), false);
    context
        .client
        .initialize(&context.authorized_escrow_contract);

    let authorized = context.client.get_authorized_escrow_contract();
    assert_eq!(authorized, Some(context.authorized_escrow_contract.clone()));
    assert_eq!(context.client.is_initialized(), true);
}

#[test]
fn initialize_cannot_be_called_twice() {
    let context = setup();

    context
        .client
        .initialize(&context.authorized_escrow_contract);

    assert_panics(|| context.client.initialize(&context.random_wallet));
}

#[test]
fn authorized_escrow_can_record_completion() {
    let context = setup();
    context
        .client
        .initialize(&context.authorized_escrow_contract);

    let job_hash = hash_from_byte(&context.env, 1);
    let review_hash = hash_from_byte(&context.env, 2);

    let result = record_completion_as_authorized(
        &context,
        10,
        &context.client_address,
        &context.freelancer_a,
        &context.asset,
        200,
        &job_hash,
        5,
        &review_hash,
    );

    assert_eq!(result, true);

    let completion = context.client.get_completion(&10);
    assert_eq!(completion.is_some(), true);

    let stored = completion.unwrap();
    assert_eq!(
        stored,
        TCompletionRecord {
            escrow_id: 10,
            client: context.client_address.clone(),
            freelancer: context.freelancer_a.clone(),
            asset: context.asset.clone(),
            amount: 200,
            job_hash,
            rating: 5,
            review_hash,
            completed_at: context.env.ledger().timestamp(),
        }
    );
}

#[test]
fn unauthorized_caller_cannot_record_completion() {
    let context = setup();
    context
        .client
        .initialize(&context.authorized_escrow_contract);

    let job_hash = hash_from_byte(&context.env, 3);
    let review_hash = hash_from_byte(&context.env, 4);

    assert_panics(|| {
        context.client.record_completion(
            &11,
            &context.client_address,
            &context.freelancer_a,
            &context.asset,
            &100,
            &job_hash,
            &4,
            &review_hash,
        )
    });
}

#[test]
fn duplicate_escrow_id_fails() {
    let context = setup();
    context
        .client
        .initialize(&context.authorized_escrow_contract);

    let first_job_hash = hash_from_byte(&context.env, 5);
    let first_review_hash = hash_from_byte(&context.env, 6);
    let second_job_hash = hash_from_byte(&context.env, 7);
    let second_review_hash = hash_from_byte(&context.env, 8);

    let first = record_completion_as_authorized(
        &context,
        12,
        &context.client_address,
        &context.freelancer_a,
        &context.asset,
        120,
        &first_job_hash,
        4,
        &first_review_hash,
    );
    assert_eq!(first, true);

    assert_panics(|| {
        record_completion_as_authorized(
            &context,
            12,
            &context.client_address,
            &context.freelancer_a,
            &context.asset,
            220,
            &second_job_hash,
            5,
            &second_review_hash,
        )
    });
}

#[test]
fn rating_validation_works() {
    let context = setup();
    context
        .client
        .initialize(&context.authorized_escrow_contract);

    let rating_min = record_completion_as_authorized(
        &context,
        20,
        &context.client_address,
        &context.freelancer_a,
        &context.asset,
        100,
        &hash_from_byte(&context.env, 9),
        1,
        &hash_from_byte(&context.env, 10),
    );
    assert_eq!(rating_min, true);

    let rating_max = record_completion_as_authorized(
        &context,
        21,
        &context.client_address,
        &context.freelancer_a,
        &context.asset,
        100,
        &hash_from_byte(&context.env, 11),
        5,
        &hash_from_byte(&context.env, 12),
    );
    assert_eq!(rating_max, true);

    assert_panics(|| {
        record_completion_as_authorized(
            &context,
            22,
            &context.client_address,
            &context.freelancer_a,
            &context.asset,
            100,
            &hash_from_byte(&context.env, 13),
            0,
            &hash_from_byte(&context.env, 14),
        )
    });

    assert_panics(|| {
        record_completion_as_authorized(
            &context,
            23,
            &context.client_address,
            &context.freelancer_a,
            &context.asset,
            100,
            &hash_from_byte(&context.env, 15),
            6,
            &hash_from_byte(&context.env, 16),
        )
    });
}

#[test]
fn amount_validation_works() {
    let context = setup();
    context
        .client
        .initialize(&context.authorized_escrow_contract);

    assert_panics(|| {
        record_completion_as_authorized(
            &context,
            30,
            &context.client_address,
            &context.freelancer_a,
            &context.asset,
            0,
            &hash_from_byte(&context.env, 17),
            4,
            &hash_from_byte(&context.env, 18),
        )
    });

    assert_panics(|| {
        record_completion_as_authorized(
            &context,
            31,
            &context.client_address,
            &context.freelancer_a,
            &context.asset,
            -1,
            &hash_from_byte(&context.env, 19),
            4,
            &hash_from_byte(&context.env, 20),
        )
    });
}

#[test]
fn freelancer_stats_update_correctly() {
    let context = setup();
    context
        .client
        .initialize(&context.authorized_escrow_contract);

    record_completion_as_authorized(
        &context,
        40,
        &context.client_address,
        &context.freelancer_a,
        &context.asset,
        200,
        &hash_from_byte(&context.env, 21),
        4,
        &hash_from_byte(&context.env, 22),
    );

    let stats_after_one = context.client.get_freelancer_stats(&context.freelancer_a);
    assert_eq!(
        stats_after_one,
        TFreelancerStatsView {
            completed_jobs_count: 1,
            total_earned: 200,
            total_rating: 4,
            average_rating: 4,
        }
    );

    record_completion_as_authorized(
        &context,
        41,
        &context.client_address,
        &context.freelancer_a,
        &context.asset,
        300,
        &hash_from_byte(&context.env, 23),
        5,
        &hash_from_byte(&context.env, 24),
    );

    let stats_after_two = context.client.get_freelancer_stats(&context.freelancer_a);
    assert_eq!(
        stats_after_two,
        TFreelancerStatsView {
            completed_jobs_count: 2,
            total_earned: 500,
            total_rating: 9,
            average_rating: 4,
        }
    );
}

#[test]
fn different_freelancers_have_separate_stats() {
    let context = setup();
    context
        .client
        .initialize(&context.authorized_escrow_contract);

    record_completion_as_authorized(
        &context,
        50,
        &context.client_address,
        &context.freelancer_a,
        &context.asset,
        150,
        &hash_from_byte(&context.env, 25),
        5,
        &hash_from_byte(&context.env, 26),
    );

    record_completion_as_authorized(
        &context,
        51,
        &context.client_address,
        &context.freelancer_b,
        &context.asset,
        250,
        &hash_from_byte(&context.env, 27),
        3,
        &hash_from_byte(&context.env, 28),
    );

    let stats_a = context.client.get_freelancer_stats(&context.freelancer_a);
    let stats_b = context.client.get_freelancer_stats(&context.freelancer_b);

    assert_eq!(
        stats_a,
        TFreelancerStatsView {
            completed_jobs_count: 1,
            total_earned: 150,
            total_rating: 5,
            average_rating: 5,
        }
    );

    assert_eq!(
        stats_b,
        TFreelancerStatsView {
            completed_jobs_count: 1,
            total_earned: 250,
            total_rating: 3,
            average_rating: 3,
        }
    );
}
