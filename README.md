# Highrable

![Highrable Logo](apps/web/public/logo/highrable-icon.jpg)

Highrable is a Stellar-native freelance marketplace that combines Soroban smart-contract escrow with wallet-first user flows and verifiable on-chain reputation.

Instead of trust-by-platform, Highrable uses trust-by-contract:

- Client and freelancer terms are represented in an escrow lifecycle on-chain.
- Funds are locked in escrow before work approval.
- Completion and rating are recorded as verifiable reputation data.
- Convex keeps a fast app state mirror and transaction history for a responsive UX.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Smart Contracts Reference](#smart-contracts-reference)
- [Frontend Architecture](#frontend-architecture)
- [Backend (Convex) Architecture](#backend-convex-architecture)
- [Project Setup Guide (Local Development)](#project-setup-guide-local-development)
- [Deployment and Verification (Testnet)](#deployment-and-verification-testnet)
- [Visuals](#visuals)
- [Implemented Features](#implemented-features)

---

## Architecture Overview

Highrable is built as a monorepo with three primary runtime layers:

1. **Soroban Smart Contracts (Rust):**
   - `highrable-escrow`: escrow lifecycle and stablecoin transfer enforcement.
   - `highrable-reputation`: immutable completion and rating records.
2. **Backend State Layer (Convex):**
   - Stores jobs, applications, escrows, transactions, and reputation records.
   - Exposes query/mutation/action APIs to the frontend.
   - Sync actions read on-chain state from Stellar RPC and reconcile Convex records.
3. **Frontend (Next.js 16 / React 19):**
   - Wallet-first UX with Stellar Wallets Kit.
   - Marketplace, job application, escrow action panel, and freelancer dashboard.
   - Wallet auth challenge/verify routes for sign-in flows.

---

## Key Features

### 1. Smart-Contract Escrow for Freelance Work

- Client creates escrow for a selected freelancer.
- Client funds escrow with USDC token contract asset.
- Freelancer submits work on-chain.
- Client either releases payment with rating or cancels/disputes based on status.

Escrow status flow:

`created -> funded -> submitted -> released`

Alternative terminal paths:

`created/funded -> cancelled`, `funded/submitted -> disputed`

### 2. On-Chain Reputation Recording

- Escrow release invokes the reputation contract.
- Completion record includes escrow ID, client, freelancer, asset, amount, rating, and review hash.
- Freelancer aggregate stats can be queried on-chain (`completed_jobs_count`, `total_earned`, `average_rating`).

### 3. Wallet-Native Authentication and Signing

- Challenge endpoint: `/api/auth/stellar/challenge`
- Verify endpoint: `/api/auth/stellar/verify`
- Signature verification uses Ed25519 public key derived from Stellar address.
- Session cookie is HMAC-signed and time-limited.

### 4. Convex-Powered Product Data and Sync

- Convex tables model jobs, applications, escrows, users, transactions, and reputation records.
- `syncEscrowStatus` checks on-chain escrow status and safely advances local status.
- `syncReputationRecord` pulls released completion data from the reputation contract into Convex.

### 5. Freelancer Dashboard and UX Flows

- Dashboard includes total earned, pending escrow, completed jobs, active jobs, and recent payouts.
- Marketplace supports posting jobs, applying, selecting freelancers, and executing escrow actions.
- USDC trustline onboarding card guides testnet users through funding + trustline setup.

---

## Project Structure

```text
Highrable-Stellar/
|-- apps/
|   `-- web/                     # Next.js web app (wallet UX + marketplace + dashboard)
|-- contracts/
|   |-- escrow/                  # Soroban escrow contract
|   `-- reputation/              # Soroban reputation contract
|-- packages/
|   |-- backend/                 # Convex backend functions and schema
|   |-- convex-client/           # Shared Convex API bindings for web app
|   |-- typescript-config/
|   `-- ui/
|-- deployments/
|   `-- testnet.json             # Generated deployment artifact with contract IDs
|-- docs/
|   `-- deployment.md            # Deployment and verification guide
`-- scripts/
    |-- deploy-testnet.sh
    `-- verify-testnet.sh
```

---

## Smart Contracts Reference

### Escrow Contract (`highrable-escrow`)

Main responsibilities:

- One-time initialization with linked reputation contract and platform admin.
- Escrow creation (`create_escrow`) with client, freelancer, asset, amount, and job hash.
- Lifecycle methods:
  - `fund_escrow`
  - `submit_work`
  - `approve_and_release` (also invokes reputation contract)
  - `cancel_escrow`
  - `mark_disputed`
- Allowlist controls for accepted assets:
  - `add_allowed_asset`, `remove_allowed_asset`, `is_allowed_asset`
- Getters:
  - `get_escrow`, `get_next_escrow_id`, `get_reputation_contract`, `get_platform_admin`

### Reputation Contract (`highrable-reputation`)

Main responsibilities:

- One-time initialization with authorized escrow contract.
- `record_completion` callable only by authorized escrow contract.
- Stores immutable completion records keyed by `escrow_id`.
- Maintains freelancer aggregate stats (`completed_jobs_count`, `total_earned`, `total_rating`).
- Getters:
  - `get_completion`, `has_completion`, `get_freelancer_stats`, `get_authorized_escrow_contract`

---

## Frontend Architecture

The frontend lives in `apps/web` and uses Next.js App Router with feature slices:

- `features/landing`: landing experience.
- `features/marketplace`: job feed, detail views, apply flow, escrow action panel.
- `features/jobs`: public job browsing.
- `features/dashboard`: freelancer income dashboard and recent payouts.

Core integrations:

- `core/wallet/*`: wallet provider, hooks, challenge/verify auth service.
- `core/stellar/*`: transaction building/signing/invocation helpers, trustline checks, explorer links.
- `@repo/convex-client`: typed Convex function access from UI.

---

## Backend (Convex) Architecture

The backend lives in `packages/backend/convex`.

### Data model tables

- `users`
- `jobs`
- `applications`
- `escrows`
- `reputationRecords`
- `transactions`

### Notable function groups

- `jobs/*`: create/list/select freelancer.
- `applications/*`: apply and query applications.
- `escrows/*`: create escrow records and update status with tx hashes.
- `reputation/*` and `reputation_records/*`: verified review and reputation record handling.
- `dashboard/*`: freelancer income summary aggregation.
- `sync.ts` and `syncMutations.ts`: on-chain -> Convex reconciliation with safe status progression.

---

## Project Setup Guide (Local Development)

### 1. Prerequisites

- Node.js 18+
- pnpm 8.6+
- Rust toolchain
- Stellar CLI
- Convex account/project configured for backend deployment

Install pnpm if needed:

```bash
npm install -g pnpm@8.6.0
```

### 2. Install dependencies (monorepo)

```bash
pnpm install
```

### 3. Build/test smart contracts

```bash
pnpm contracts:build
cd contracts && cargo test
```

### 4. Configure backend environment

Create backend env from template:

```bash
cp packages/backend/.env.example packages/backend/.env.local
```

Set required values:

- `STELLAR_NETWORK`
- `STELLAR_RPC_URL`
- `STELLAR_HORIZON_URL`
- `REPUTATION_CONTRACT_ID`
- `ESCROW_CONTRACT_ID`
- `STELLAR_READ_SOURCE_ACCOUNT`

Run backend:

```bash
cd packages/backend
pnpm dev
```

### 5. Configure frontend environment

Create frontend env from template:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Set required values:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_STELLAR_NETWORK`
- `NEXT_PUBLIC_STELLAR_RPC_URL`
- `NEXT_PUBLIC_STELLAR_HORIZON_URL`
- `NEXT_PUBLIC_REPUTATION_CONTRACT_ID`
- `NEXT_PUBLIC_ESCROW_CONTRACT_ID`
- `NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

Run frontend:

```bash
cd apps/web
pnpm dev
```

Or run monorepo dev tasks together from root:

```bash
pnpm dev
```

---

## Deployment and Verification (Testnet)

Deploy contracts and generate artifact (`deployments/testnet.json`):

```bash
DEPLOYER=<stellar_identity> PLATFORM_ADMIN=<stellar_public_key> pnpm contracts:deploy:testnet
```

Verify an existing deployment:

```bash
DEPLOYER=<stellar_identity> pnpm contracts:verify:testnet
```

Reference guide: `docs/deployment.md`

Current artifact fields include:

- Network and RPC/Horizon URLs
- Reputation contract ID
- Escrow contract ID
- Platform admin
- Deployer identity/address
- Deployment timestamp

---

## Visuals

### Logos

- Highrable icon: `apps/web/public/logo/highrable-icon.jpg`
- Stellar symbol: `apps/web/public/logo/stellar/Stellar_Symbol.png`

### Demo and screenshots

UI screenshots are not yet versioned in this repository. Add them under `apps/web/public/` and reference them here for product walkthroughs.

---

## Implemented Features

- End-to-end escrow workflow on Soroban: create, fund, submit, release, cancel, dispute.
- Cross-contract completion recording from escrow contract into reputation contract.
- Wallet-based auth challenge and signature verification routes.
- Convex data model and APIs for jobs, applications, escrows, transactions, and reputation.
- Sync actions that reconcile Convex records with on-chain escrow/reputation state.
- Freelancer dashboard with earnings aggregation and recent payouts.
- Testnet deployment + verification scripts with generated deployment artifact.
