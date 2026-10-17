#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, IntoVal, Symbol, Val, Vec};

const INSTANCE_TTL_THRESHOLD: u32 = 100;
const INSTANCE_TTL_EXTEND_TO: u32 = 518_400;
const REGISTRATION_TTL_THRESHOLD: u32 = 100;
const REGISTRATION_TTL_EXTEND_TO: u32 = 518_400;

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Registration(Address),
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Registration {
    pub address: Address,
    pub registered_at: u64,
}

#[contract]
pub struct UserRegistry;

#[contractimpl]
impl UserRegistry {
    pub fn register(env: Env, user: Address) -> Registration {
        touch_instance(&env);
        user.require_auth();

        let key = DataKey::Registration(user.clone());
        if let Some(registration) = env
            .storage()
            .persistent()
            .get::<DataKey, Registration>(&key)
        {
            touch_registration(&env, &key);
            return registration;
        }

        let registration = Registration {
            address: user.clone(),
            registered_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &registration);
        touch_registration(&env, &key);
        let mut topics: Vec<Val> = Vec::new(&env);
        topics.push_back(Symbol::new(&env, "registry").into_val(&env));
        topics.push_back(Symbol::new(&env, "registered_v1").into_val(&env));
        topics.push_back(user.into_val(&env));
        env.events().publish(topics, registration.registered_at);

        registration
    }

    pub fn get_registration(env: Env, user: Address) -> Option<Registration> {
        touch_instance(&env);
        let key = DataKey::Registration(user);
        let registration = env
            .storage()
            .persistent()
            .get::<DataKey, Registration>(&key);
        if registration.is_some() {
            touch_registration(&env, &key);
        }
        registration
    }

    pub fn is_registered(env: Env, user: Address) -> bool {
        touch_instance(&env);
        let key = DataKey::Registration(user);
        let is_registered = env.storage().persistent().has(&key);
        if is_registered {
            touch_registration(&env, &key);
        }
        is_registered
    }
}

fn touch_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn touch_registration(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(
        key,
        REGISTRATION_TTL_THRESHOLD,
        REGISTRATION_TTL_EXTEND_TO,
    );
}

#[cfg(test)]
mod test;
