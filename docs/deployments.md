# Contract Deployment (Stellar Testnet)

This guide deploys Highrable smart contracts in a repeatable way and stores contract IDs in a tracked artifact.

## Prerequisites

- Stellar CLI installed (`stellar --version`)
- A funded testnet identity (example: `stellar keys generate --global highrable-deployer --network testnet --fund`)
- Rust toolchain installed for contract build

## Deployment Workflow

Run from repository root:

```bash
DEPLOYER=highrable-deployer \
PLATFORM_ADMIN=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
pnpm contracts:deploy:testnet
```

The script does the following:

1. Builds both contracts in `contracts/`.
2. Deploys `highrable-reputation` and `highrable-escrow`.
3. Initializes contracts in strict order:
   - `Escrow.initialize(reputation_contract_address, platform_admin)`
   - `Reputation.initialize(authorized_escrow_contract)`
4. Verifies deployment wiring with getters:
   - `Reputation.get_authorized_escrow_contract`
   - `Escrow.get_reputation_contract`
   - `Escrow.get_platform_admin`
   - `Escrow.get_next_escrow_id`
5. Writes deployment artifact to `deployments/testnet.json`.

## Verification Workflow

To verify an existing deployment:

```bash
DEPLOYER=highrable-deployer pnpm contracts:verify:testnet
```

By default this reads IDs from `deployments/testnet.json`. You can override via env vars:

- `REPUTATION_CONTRACT_ID`
- `ESCROW_CONTRACT_ID`
- `PLATFORM_ADMIN`

## Environment Setup

After deployment, copy IDs into:

- `apps/web/.env.local` (template at `apps/web/.env.example`)
- `packages/backend/.env.local` or Convex environment (template at `packages/backend/.env.example`)

Required frontend vars:

- `NEXT_PUBLIC_REPUTATION_CONTRACT_ID`
- `NEXT_PUBLIC_ESCROW_CONTRACT_ID`
- `NEXT_PUBLIC_STELLAR_RPC_URL`
- `NEXT_PUBLIC_STELLAR_HORIZON_URL`
- `NEXT_PUBLIC_STELLAR_NETWORK`
- `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE`

Passkey smart-account frontend vars:

- `NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH`
- `NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID`
- `NEXT_PUBLIC_APP_DOMAIN`
- `NEXT_PUBLIC_PASSKEY_RP_NAME`
- `NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL` (optional)

For the current tested `smart-account-kit 0.2.10` Testnet values and operational notes, see `passkey-smart-accounts.md`.

Required backend vars:

- `REPUTATION_CONTRACT_ID`
- `ESCROW_CONTRACT_ID`
- `STELLAR_RPC_URL`
- `STELLAR_HORIZON_URL`

## Committed Artifact Policy

`deployments/testnet.json` should be committed after each successful deployment so the exact on-chain IDs are versioned with the codebase.
