#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env};

const INSTANCE_TTL_THRESHOLD: u32 = 100;
const INSTANCE_TTL_EXTEND_TO: u32 = 518_400;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    AuthorizedEscrowContract,
    Completion(u64),
    FreelancerStats(Address),
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TCompletionRecord {
    pub escrow_id: u64,
    pub client: Address,
    pub freelancer: Address,
    pub asset: Address,
    pub amount: i128,
    pub job_hash: BytesN<32>,
    pub rating: u32,
    pub review_hash: BytesN<32>,
    pub completed_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TFreelancerStats {
    pub completed_jobs_count: u32,
    pub total_earned: i128,
    pub total_rating: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TFreelancerStatsView {
    pub completed_jobs_count: u32,
    pub total_earned: i128,
    pub total_rating: u32,
    pub average_rating: u32,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    CompletionAlreadyRecorded = 4,
    InvalidRating = 5,
    InvalidAmount = 6,
    ArithmeticOverflow = 7,
}

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    pub fn initialize(env: Env, authorized_escrow_contract: Address) -> Result<(), Error> {
        touch_instance(&env);

        if is_initialized_internal(&env) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage()
            .instance()
            .set(&DataKey::AuthorizedEscrowContract, &authorized_escrow_contract);

        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn record_completion(
        env: Env,
        escrow_id: u64,
        client: Address,
        freelancer: Address,
        asset: Address,
        amount: i128,
        job_hash: BytesN<32>,
        rating: u32,
        review_hash: BytesN<32>,
    ) -> Result<bool, Error> {
        touch_instance(&env);

        let authorized_escrow_contract = get_authorized_escrow_contract_internal(&env)?;
        authorized_escrow_contract.require_auth();

        validate_amount(amount)?;
        validate_rating(rating)?;

        let completion_key = DataKey::Completion(escrow_id);
        if env.storage().persistent().has(&completion_key) {
            return Err(Error::CompletionAlreadyRecorded);
        }

        let completed_at = env.ledger().timestamp();
        let completion_record = TCompletionRecord {
            escrow_id,
            client,
            freelancer: freelancer.clone(),
            asset,
            amount,
            job_hash,
            rating,
            review_hash,
            completed_at,
        };

        env.storage()
            .persistent()
            .set(&completion_key, &completion_record);

        let freelancer_stats_key = DataKey::FreelancerStats(freelancer);
        let current_stats = env
            .storage()
            .persistent()
            .get::<DataKey, TFreelancerStats>(&freelancer_stats_key)
            .unwrap_or(default_freelancer_stats());

        let updated_stats = TFreelancerStats {
            completed_jobs_count: current_stats
                .completed_jobs_count
                .checked_add(1)
                .ok_or(Error::ArithmeticOverflow)?,
            total_earned: current_stats
                .total_earned
                .checked_add(amount)
                .ok_or(Error::ArithmeticOverflow)?,
            total_rating: current_stats
                .total_rating
                .checked_add(rating)
                .ok_or(Error::ArithmeticOverflow)?,
        };

        env.storage()
            .persistent()
            .set(&freelancer_stats_key, &updated_stats);

        Ok(true)
    }

    pub fn get_completion(env: Env, escrow_id: u64) -> Option<TCompletionRecord> {
        touch_instance(&env);
        env.storage()
            .persistent()
            .get::<DataKey, TCompletionRecord>(&DataKey::Completion(escrow_id))
    }

    pub fn has_completion(env: Env, escrow_id: u64) -> bool {
        touch_instance(&env);
        env.storage().persistent().has(&DataKey::Completion(escrow_id))
    }

    pub fn get_freelancer_stats(env: Env, freelancer: Address) -> TFreelancerStatsView {
        touch_instance(&env);

        let stats = env
            .storage()
            .persistent()
            .get::<DataKey, TFreelancerStats>(&DataKey::FreelancerStats(freelancer))
            .unwrap_or(default_freelancer_stats());

        let average_rating = if stats.completed_jobs_count == 0 {
            0
        } else {
            stats.total_rating / stats.completed_jobs_count
        };

        TFreelancerStatsView {
            completed_jobs_count: stats.completed_jobs_count,
            total_earned: stats.total_earned,
            total_rating: stats.total_rating,
            average_rating,
        }
    }

    pub fn get_authorized_escrow_contract(env: Env) -> Option<Address> {
        touch_instance(&env);
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::AuthorizedEscrowContract)
    }

    pub fn is_initialized(env: Env) -> bool {
        touch_instance(&env);
        is_initialized_internal(&env)
    }
}

fn is_initialized_internal(env: &Env) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::AuthorizedEscrowContract)
}

fn get_authorized_escrow_contract_internal(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::AuthorizedEscrowContract)
        .ok_or(Error::NotInitialized)
}

fn default_freelancer_stats() -> TFreelancerStats {
    TFreelancerStats {
        completed_jobs_count: 0,
        total_earned: 0,
        total_rating: 0,
    }
}

fn validate_rating(rating: u32) -> Result<(), Error> {
    if !(1..=5).contains(&rating) {
        return Err(Error::InvalidRating);
    }

    Ok(())
}

fn validate_amount(amount: i128) -> Result<(), Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }

    Ok(())
}

fn touch_instance(env: &Env) {
    env.storage()
        .instance()
    .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

#[cfg(test)]
mod test;
