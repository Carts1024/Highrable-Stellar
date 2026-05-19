#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, vec, Address, BytesN, Env, IntoVal,
    Symbol,
};

const INSTANCE_TTL_THRESHOLD: u32 = 100;
const INSTANCE_TTL_EXTEND_TO: u32 = 518_400;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Initialized,
    ReputationContract,
    PlatformAdmin,
    NextEscrowId,
    AllowedAsset(Address),
    AllowedAssetCount,
    Escrow(u64),
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum TEscrowStatus {
    Created,
    Funded,
    Submitted,
    Released,
    Cancelled,
    Disputed,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TEscrow {
    pub escrow_id: u64,
    pub client: Address,
    pub freelancer: Option<Address>,
    pub asset: Address,
    pub amount: i128,
    pub job_hash: BytesN<32>,
    pub proof_hash: Option<BytesN<32>>,
    pub status: TEscrowStatus,
    pub created_at: u64,
    pub funded_at: u64,
    pub submitted_at: u64,
    pub released_at: u64,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
#[contracterror]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    EscrowNotFound = 5,
    InvalidStatus = 6,
    InvalidRating = 7,
    InvalidFreelancer = 8,
    AssetNotAllowed = 9,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn initialize(
        env: Env,
        reputation_contract_address: Address,
        platform_admin: Address,
    ) -> Result<(), Error> {
        touch_instance(&env);

        if is_initialized_internal(&env) {
            return Err(Error::AlreadyInitialized);
        }

        platform_admin.require_auth();

        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage()
            .instance()
            .set(&DataKey::ReputationContract, &reputation_contract_address);
        env.storage()
            .instance()
            .set(&DataKey::PlatformAdmin, &platform_admin);
        env.storage().instance().set(&DataKey::NextEscrowId, &1u64);

        Ok(())
    }

    pub fn create_escrow(
        env: Env,
        client: Address,
        freelancer: Address,
        asset: Address,
        amount: i128,
        job_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        touch_instance(&env);
        require_initialized(&env)?;

        client.require_auth();

        if client == freelancer {
            return Err(Error::InvalidFreelancer);
        }

        create_escrow_internal(
            &env,
            client,
            Some(freelancer),
            asset,
            amount,
            job_hash,
            TEscrowStatus::Created,
            0,
        )
    }

    pub fn create_open_escrow(
        env: Env,
        client: Address,
        asset: Address,
        amount: i128,
        job_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        touch_instance(&env);
        require_initialized(&env)?;

        client.require_auth();

        create_escrow_internal(
            &env,
            client,
            None,
            asset,
            amount,
            job_hash,
            TEscrowStatus::Created,
            0,
        )
    }

    pub fn create_and_fund_open_escrow(
        env: Env,
        client: Address,
        asset: Address,
        amount: i128,
        job_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        touch_instance(&env);
        require_initialized(&env)?;

        client.require_auth();

        let funded_at = now(&env);
        let escrow_id = create_escrow_internal(
            &env,
            client.clone(),
            None,
            asset,
            amount,
            job_hash,
            TEscrowStatus::Funded,
            funded_at,
        )?;

        let escrow = read_escrow(&env, escrow_id)?;
        transfer_to_contract(&env, &client, &escrow.asset, &escrow.amount);

        Ok(escrow_id)
    }

    pub fn add_allowed_asset(
        env: Env,
        platform_admin: Address,
        asset: Address,
    ) -> Result<(), Error> {
        touch_instance(&env);
        require_initialized(&env)?;
        require_platform_admin(&env, &platform_admin)?;

        let key = DataKey::AllowedAsset(asset);
        if !env.storage().instance().has(&key) {
            env.storage().instance().set(&key, &true);
            let next_count = get_allowed_asset_count_internal(&env) + 1;
            env.storage()
                .instance()
                .set(&DataKey::AllowedAssetCount, &next_count);
        }

        Ok(())
    }

    pub fn remove_allowed_asset(
        env: Env,
        platform_admin: Address,
        asset: Address,
    ) -> Result<(), Error> {
        touch_instance(&env);
        require_initialized(&env)?;
        require_platform_admin(&env, &platform_admin)?;

        let key = DataKey::AllowedAsset(asset);
        if env.storage().instance().has(&key) {
            env.storage().instance().remove(&key);

            let current_count = get_allowed_asset_count_internal(&env);
            let next_count = if current_count == 0 {
                0
            } else {
                current_count - 1
            };
            env.storage()
                .instance()
                .set(&DataKey::AllowedAssetCount, &next_count);
        }

        Ok(())
    }

    pub fn is_allowed_asset(env: Env, asset: Address) -> Result<bool, Error> {
        touch_instance(&env);
        require_initialized(&env)?;
        Ok(is_allowed_asset_internal(&env, &asset))
    }

    pub fn get_allowed_asset_count(env: Env) -> Result<u32, Error> {
        touch_instance(&env);
        require_initialized(&env)?;
        Ok(get_allowed_asset_count_internal(&env))
    }

    pub fn fund_escrow(env: Env, client: Address, escrow_id: u64) -> Result<(), Error> {
        touch_instance(&env);
        require_initialized(&env)?;

        client.require_auth();

        let mut escrow = read_escrow(&env, escrow_id)?;
        require_status(&escrow.status, TEscrowStatus::Created)?;

        if escrow.client != client {
            return Err(Error::Unauthorized);
        }

        transfer_to_contract(&env, &client, &escrow.asset, &escrow.amount);

        escrow.status = TEscrowStatus::Funded;
        escrow.funded_at = now(&env);

        write_escrow(&env, &escrow);

        Ok(())
    }

    pub fn assign_freelancer(
        env: Env,
        client: Address,
        escrow_id: u64,
        freelancer: Address,
    ) -> Result<(), Error> {
        touch_instance(&env);
        require_initialized(&env)?;

        client.require_auth();

        let mut escrow = read_escrow(&env, escrow_id)?;

        if escrow.client != client {
            return Err(Error::Unauthorized);
        }

        if client == freelancer {
            return Err(Error::InvalidFreelancer);
        }

        if escrow.freelancer.is_some() {
            return Err(Error::InvalidStatus);
        }

        match escrow.status {
            TEscrowStatus::Created | TEscrowStatus::Funded => {
                escrow.freelancer = Some(freelancer);
            }
            TEscrowStatus::Submitted
            | TEscrowStatus::Released
            | TEscrowStatus::Cancelled
            | TEscrowStatus::Disputed => {
                return Err(Error::InvalidStatus);
            }
        }

        write_escrow(&env, &escrow);

        Ok(())
    }

    pub fn submit_work(
        env: Env,
        freelancer: Address,
        escrow_id: u64,
        proof_hash: BytesN<32>,
    ) -> Result<(), Error> {
        touch_instance(&env);
        require_initialized(&env)?;

        freelancer.require_auth();

        let mut escrow = read_escrow(&env, escrow_id)?;
        require_status(&escrow.status, TEscrowStatus::Funded)?;

        let assigned_freelancer = get_assigned_freelancer(&escrow)?;
        if assigned_freelancer != freelancer {
            return Err(Error::Unauthorized);
        }

        escrow.status = TEscrowStatus::Submitted;
        escrow.proof_hash = Some(proof_hash);
        escrow.submitted_at = now(&env);

        write_escrow(&env, &escrow);

        Ok(())
    }

    pub fn approve_and_release(
        env: Env,
        client: Address,
        escrow_id: u64,
        rating: u32,
        review_hash: BytesN<32>,
    ) -> Result<(), Error> {
        touch_instance(&env);
        require_initialized(&env)?;

        client.require_auth();
        validate_rating(rating)?;

        let mut escrow = read_escrow(&env, escrow_id)?;
        require_status(&escrow.status, TEscrowStatus::Submitted)?;

        if escrow.client != client {
            return Err(Error::Unauthorized);
        }

        let freelancer = get_assigned_freelancer(&escrow)?;
        let contract_address = env.current_contract_address();
        let token_client = token::Client::new(&env, &escrow.asset);

        token_client.transfer(&contract_address, &freelancer, &escrow.amount);

        let reputation_contract = get_reputation_contract_internal(&env)?;
        env.invoke_contract::<bool>(
            &reputation_contract,
            &Symbol::new(&env, "record_completion"),
            vec![
                &env,
                escrow.escrow_id.into_val(&env),
                escrow.client.into_val(&env),
                freelancer.into_val(&env),
                escrow.asset.into_val(&env),
                escrow.amount.into_val(&env),
                escrow.job_hash.into_val(&env),
                rating.into_val(&env),
                review_hash.into_val(&env),
            ],
        );

        escrow.status = TEscrowStatus::Released;
        escrow.released_at = now(&env);

        write_escrow(&env, &escrow);

        Ok(())
    }

    pub fn cancel_escrow(env: Env, client: Address, escrow_id: u64) -> Result<(), Error> {
        touch_instance(&env);
        require_initialized(&env)?;

        client.require_auth();

        let mut escrow = read_escrow(&env, escrow_id)?;

        if escrow.client != client {
            return Err(Error::Unauthorized);
        }

        match escrow.status {
            TEscrowStatus::Created => {
                escrow.status = TEscrowStatus::Cancelled;
            }
            TEscrowStatus::Funded => {
                let token_client = token::Client::new(&env, &escrow.asset);
                let contract_address = env.current_contract_address();
                token_client.transfer(&contract_address, &client, &escrow.amount);
                escrow.status = TEscrowStatus::Cancelled;
            }
            TEscrowStatus::Submitted => {
                return Err(Error::InvalidStatus);
            }
            TEscrowStatus::Released | TEscrowStatus::Cancelled | TEscrowStatus::Disputed => {
                return Err(Error::InvalidStatus);
            }
        }

        write_escrow(&env, &escrow);

        Ok(())
    }

    pub fn mark_disputed(env: Env, caller: Address, escrow_id: u64) -> Result<(), Error> {
        touch_instance(&env);
        require_initialized(&env)?;

        caller.require_auth();

        let mut escrow = read_escrow(&env, escrow_id)?;
        let assigned_freelancer = get_assigned_freelancer(&escrow)?;

        if caller != escrow.client && caller != assigned_freelancer {
            return Err(Error::Unauthorized);
        }

        match escrow.status {
            TEscrowStatus::Funded | TEscrowStatus::Submitted => {
                escrow.status = TEscrowStatus::Disputed;
            }
            TEscrowStatus::Created
            | TEscrowStatus::Released
            | TEscrowStatus::Cancelled
            | TEscrowStatus::Disputed => {
                return Err(Error::InvalidStatus);
            }
        }

        write_escrow(&env, &escrow);

        Ok(())
    }

    pub fn get_escrow(env: Env, escrow_id: u64) -> TEscrow {
        touch_instance(&env);
        read_escrow(&env, escrow_id).unwrap()
    }

    pub fn get_next_escrow_id(env: Env) -> Result<u64, Error> {
        touch_instance(&env);
        require_initialized(&env)?;
        get_next_escrow_id_internal(&env)
    }

    pub fn get_reputation_contract(env: Env) -> Result<Address, Error> {
        touch_instance(&env);
        require_initialized(&env)?;
        get_reputation_contract_internal(&env)
    }

    pub fn get_platform_admin(env: Env) -> Result<Address, Error> {
        touch_instance(&env);
        require_initialized(&env)?;
        env.storage()
            .instance()
            .get::<DataKey, Address>(&DataKey::PlatformAdmin)
            .ok_or(Error::NotInitialized)
    }

    pub fn is_initialized(env: Env) -> bool {
        touch_instance(&env);
        is_initialized_internal(&env)
    }
}

fn read_escrow(env: &Env, escrow_id: u64) -> Result<TEscrow, Error> {
    env.storage()
        .persistent()
        .get::<DataKey, TEscrow>(&DataKey::Escrow(escrow_id))
        .ok_or(Error::EscrowNotFound)
}

fn write_escrow(env: &Env, escrow: &TEscrow) {
    env.storage()
        .persistent()
        .set(&DataKey::Escrow(escrow.escrow_id), escrow);
}

fn create_escrow_internal(
    env: &Env,
    client: Address,
    freelancer: Option<Address>,
    asset: Address,
    amount: i128,
    job_hash: BytesN<32>,
    status: TEscrowStatus,
    funded_at: u64,
) -> Result<u64, Error> {
    validate_amount(amount)?;

    if should_enforce_asset_allowlist(env) && !is_allowed_asset_internal(env, &asset) {
        return Err(Error::AssetNotAllowed);
    }

    let escrow_id = get_next_escrow_id_internal(env)?;
    let escrow = TEscrow {
        escrow_id,
        client,
        freelancer,
        asset,
        amount,
        job_hash,
        proof_hash: None,
        status,
        created_at: now(env),
        funded_at,
        submitted_at: 0,
        released_at: 0,
    };

    write_escrow(env, &escrow);
    env.storage()
        .instance()
        .set(&DataKey::NextEscrowId, &(escrow_id + 1));

    Ok(escrow_id)
}

fn transfer_to_contract(env: &Env, client: &Address, asset: &Address, amount: &i128) {
    let token_client = token::Client::new(env, asset);
    let contract_address = env.current_contract_address();

    token_client.transfer(client, &contract_address, amount);
}

fn get_assigned_freelancer(escrow: &TEscrow) -> Result<Address, Error> {
    escrow.freelancer.clone().ok_or(Error::InvalidFreelancer)
}

fn is_initialized_internal(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Initialized)
}

fn require_initialized(env: &Env) -> Result<(), Error> {
    if !is_initialized_internal(env) {
        return Err(Error::NotInitialized);
    }

    Ok(())
}

fn get_next_escrow_id_internal(env: &Env) -> Result<u64, Error> {
    env.storage()
        .instance()
        .get::<DataKey, u64>(&DataKey::NextEscrowId)
        .ok_or(Error::NotInitialized)
}

fn get_reputation_contract_internal(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::ReputationContract)
        .ok_or(Error::NotInitialized)
}

fn require_platform_admin(env: &Env, platform_admin: &Address) -> Result<(), Error> {
    platform_admin.require_auth();

    let stored_admin = env
        .storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::PlatformAdmin)
        .ok_or(Error::NotInitialized)?;

    if &stored_admin != platform_admin {
        return Err(Error::Unauthorized);
    }

    Ok(())
}

fn get_allowed_asset_count_internal(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::AllowedAssetCount)
        .unwrap_or(0)
}

fn should_enforce_asset_allowlist(env: &Env) -> bool {
    get_allowed_asset_count_internal(env) > 0
}

fn is_allowed_asset_internal(env: &Env, asset: &Address) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::AllowedAsset(asset.clone()))
}

fn require_status(actual: &TEscrowStatus, expected: TEscrowStatus) -> Result<(), Error> {
    if *actual != expected {
        return Err(Error::InvalidStatus);
    }

    Ok(())
}

fn validate_amount(amount: i128) -> Result<(), Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }

    Ok(())
}

fn validate_rating(rating: u32) -> Result<(), Error> {
    if !(1..=5).contains(&rating) {
        return Err(Error::InvalidRating);
    }

    Ok(())
}

fn now(env: &Env) -> u64 {
    env.ledger().timestamp()
}

fn touch_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

#[cfg(test)]
mod test;
