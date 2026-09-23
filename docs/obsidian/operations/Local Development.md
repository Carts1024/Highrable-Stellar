---
type: runbook
area: operations
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Local Development

## Prerequisites

- Node.js `>=20.9.0` from the root `package.json` engine declaration.
- pnpm `12.5.1` from the root `packageManager` declaration.
- Rust toolchain and Stellar CLI for contract work.
- Convex project/configuration for backend work.
- A funded Stellar testnet wallet for live escrow tests.

## Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
cp packages/backend/.env.example packages/backend/.env.local
```

Fill the copied files with the required public network/contract/Convex values and local server/admin values. Never copy secret values into tracked documentation.

## Run the app

Full workspace:

```bash
pnpm dev
```

Separate processes:

```bash
cd packages/backend && pnpm dev
cd apps/web && pnpm dev
```

The web package serves on port 3000 by its package script. Convex's `dev` command manages the backend development process.

## Common checks

```bash
pnpm build
pnpm lint:fix
pnpm --filter web test
pnpm contracts:build
cd contracts && cargo test
```

`lint:fix` is mutating and may reformat source; inspect the diff afterward. Contract deployment scripts are live-network operations and are not part of ordinary local setup.

## Network safety

Use testnet/local endpoints and test accounts for development. Confirm the network label, passphrase, RPC, Horizon, contract IDs, and wallet network agree before signing. See [[stellar/Network Configuration]] and [[operations/Testing]].
