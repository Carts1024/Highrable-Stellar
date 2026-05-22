# Highrable

![Highrable Logo](apps/web/public/logo/highrable-icon.jpg)

Highrable is a Stellar-native freelance marketplace that replaces trust-by-platform with trust-by-contract. Client funds are locked in Soroban escrow, releases write immutable on-chain reputation, and Convex mirrors product state for a fast app experience.

## Problem

Traditional freelance platforms still have the same structural issues:

- Clients and freelancers rely on platform promises instead of verifiable settlement rules.
- Funds are often held in opaque internal systems rather than transparent escrow logic.
- Reputation is platform-owned, hard to verify, and not portable across marketplaces.
- Cross-border payouts remain slow, expensive, and uneven for global talent.
- Disputes, cancellations, and work proof often live in fragmented off-platform workflows.

## Vision

Build a global freelance marketplace where agreements, payments, and reputation are verifiable by default. Highrable uses Stellar and Soroban so remote work can be coordinated with low-friction payments, transparent settlement, and portable proof of completed work.

## Purpose

This repository implements the core product infrastructure behind that model:

- Soroban smart contracts enforce escrow lifecycle and reputation recording.
- Convex stores the operational mirror of jobs, applications, escrows, disputes, attachments, chat, and transaction history.
- A Next.js web app delivers wallet-native UX, passkey smart-account support, public profiles, dashboard views, and admin tooling.

## Target Users

- Freelancers who need fast, lower-cost, cross-border payouts and verifiable work history.
- Clients who want stronger payment assurance, transparent milestone handling, and better hiring trust signals.
- Platform operators who need moderation, dispute management, and contract-backed marketplace workflows.

## Features

- Smart-contract escrow lifecycle for create, fund, submit, release, cancel, and dispute flows.
- On-chain reputation recording tied to real escrow completions rather than editable platform reviews.
- Wallet-native authentication plus passkey smart-account support for contract interactions.
- Marketplace workflows for job posting, applications, freelancer selection, and escrow actions.
- Dashboard, profile, and proof surfaces for earnings, trust history, and shareable completion records.
- Product workflows beyond payment, including attachments, work agreements, submissions, chat, deadlines, cancellations, and admin dispute operations.

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript, TanStack Query, Framer Motion, Stellar Wallets Kit.
- Backend: Convex, TypeScript, shared typed client bindings.
- Blockchain: Stellar, Soroban smart contracts in Rust, Stellar SDK, Stellar RPC/Horizon, smart-account-kit.
- Tooling: pnpm workspaces, Turborepo, oxlint, oxfmt, Husky.

## Architecture Snapshot

Highrable is organized as a three-layer monorepo:

1. Frontend in `apps/web`
   Handles wallet UX, auth challenge/verify flows, job and dashboard pages, escrow interaction flows, passkey smart-account flows, admin surfaces, and marketing pages.
2. Smart contracts in `contracts/escrow` and `contracts/reputation`
   Enforce escrow state transitions, fund custody, release logic, and immutable completion records.
3. Backend state layer in `packages/backend/convex`
   Mirrors marketplace state for fast reads, stores operational records, and runs sync logic against on-chain data.

## Current Codebase Status

Implemented today:

- Escrow and reputation contracts with test coverage.
- Convex data model for jobs, milestones, applications, escrows, transactions, disputes, cancellations, attachments, chat, notifications, agreements, and submissions.
- Frontend flows for marketplace browsing, job posting, dashboards, profiles, proof pages, wallet auth, and passkey smart accounts.
- Admin surfaces for dispute review, moderation notes, and settlement recording.

Still partial or clearly placeholder:

- Talent directory is present as a surface but not yet a full live directory experience.
- Some marketing content references AI-assisted hiring features that are not yet represented as implemented backend or product workflows in this repository.

## Project Structure

```text
Highrable-Stellar/
|-- apps/
|   `-- web/                     # Next.js web app
|-- contracts/
|   |-- escrow/                  # Soroban escrow contract
|   `-- reputation/              # Soroban reputation contract
|-- packages/
|   |-- backend/                 # Convex backend
|   |-- convex-client/           # Shared typed client bindings
|   |-- typescript-config/
|   `-- ui/                      # Shared UI components/providers
|-- deployments/                 # Generated deployment artifacts
|-- docs/                        # Product, ops, deployment, and implementation docs
`-- scripts/                     # Deployment and verification helpers
```

## How to Run Locally

### Prerequisites

- Node.js 20.9+
- pnpm 11+
- Rust toolchain
- Stellar CLI
- Convex account/project for backend development

### Install dependencies

```bash
pnpm install
```

### Configure backend environment

```bash
cp packages/backend/.env.example packages/backend/.env.local
```

Minimum backend variables:

- `STELLAR_NETWORK`
- `STELLAR_RPC_URL`
- `STELLAR_HORIZON_URL`
- `REPUTATION_CONTRACT_ID`
- `ESCROW_CONTRACT_ID`
- `STELLAR_READ_SOURCE_ACCOUNT`
- `HIGHRABLE_ADMIN_WALLET_ADDRESS`
- `HIGHRABLE_ADMIN_CONVEX_SECRET`

### Configure frontend environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Common frontend variables:

- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_STELLAR_NETWORK`
- `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE`
- `NEXT_PUBLIC_STELLAR_RPC_URL`
- `NEXT_PUBLIC_STELLAR_HORIZON_URL`
- `NEXT_PUBLIC_ESCROW_CONTRACT_ID`
- `NEXT_PUBLIC_REPUTATION_CONTRACT_ID`
- `NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID`
- `NEXT_PUBLIC_APP_DOMAIN`
- `NEXT_PUBLIC_PASSKEY_RP_NAME`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

Passkey and relayer configuration is also supported through the same env template when those flows are enabled.

### Run the app

Run the monorepo dev tasks:

```bash
pnpm dev
```

Or run individual surfaces:

```bash
cd packages/backend && pnpm dev
cd apps/web && pnpm dev
```

### Build and test contracts

```bash
pnpm contracts:build
cd contracts && cargo test
```

## Deployment

### Testnet

Deploy contracts and write deployment metadata:

```bash
DEPLOYER=<stellar_identity> PLATFORM_ADMIN=<stellar_public_key> pnpm contracts:deploy:testnet
```

Verify an existing testnet deployment:

```bash
DEPLOYER=<stellar_identity> pnpm contracts:verify:testnet
```

Related artifacts and docs:

- `deployments/testnet.json`
- `docs/deployments.md`
- `docs/stablecoin-payments.md`
- `docs/passkey-smart-account-implementation.md`
- `docs/mainnet-smart-account-readiness.md`

### Mainnet

Mainnet deployment helpers exist in the repository, but operational readiness should be reviewed alongside the deployment and smart-account readiness docs before publishing a production environment.

## Demo

- Live app: [Highrable](www.highrable.work)
- Demo video: [Demo Video](https://drive.google.com/drive/folders/1SNSxRG1NNy0hip1uO_nbwKSQipTo3hV4?usp=drive_link)
- Screenshots: UI assets exist in the app, but a dedicated README screenshot set has not been versioned yet.

## Team

Contributor roles and public profile links are not currently documented in this repository. Add them here before external submission or launch.

## License

This repository does not currently include a root license file. Add an explicit license before distributing the code outside its current intended scope.
