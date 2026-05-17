# Highrable | Project Instructions

Highrable is a Stellar-native freelance marketplace combining Soroban smart-contract escrow with wallet-first user flows and verifiable on-chain reputation.

## Project Overview

Highrable uses a "trust-by-contract" model where client and freelancer terms are managed via on-chain escrows. The system is built as a monorepo with three primary layers:

1.  **Soroban Smart Contracts (Rust):**
    *  `contracts/escrow`: Manages the lifecycle of work escrows (funding, submission, release, disputes).
    *  `contracts/reputation`: Records immutable completion data and aggregate freelancer stats.
2.  **Backend State Layer (Convex):**
    *  `packages/backend`: Fast application state mirror and transaction history.
    *  `packages/backend/convex/sync.ts`: Reconciles on-chain state from Stellar RPC with local database records via sync actions.
3.  **Frontend (Next.js 16 / React 19):**
    *  `apps/web`: Wallet-first UX using Stellar Wallets Kit and Passkey Smart Accounts.
    *  Follows a feature-sliced architecture: `landing`, `marketplace`, `jobs`, `dashboard`.

## Technical Stack

*  **Monorepo Management:** `pnpm`, `turbo`.
*  **Frontend:** Next.js 16 (App Router), React 19, `@stellar/stellar-sdk`, `@creit-tech/stellar-wallets-kit`, `convex`, `@tanstack/react-query`, `framer-motion`.
*  **Backend:** Convex (Serverless functions), TypeScript.
*  **Smart Contracts:** Soroban SDK v22 (Rust).
*  **Tooling:** `oxlint` (linting), `oxfmt` (formatting), `husky`.

## Building and Running

### Prerequisites
*  Node.js 18+
*  pnpm 8.6+
*  Rust toolchain & Stellar CLI

### Key Commands

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Runs Next.js web app and Convex backend concurrently. |
| `pnpm build` | Builds all packages and applications. |
| `pnpm contracts:build` | Compiles Soroban contracts using `stellar contract build`. |
| `pnpm contracts:deploy:testnet` | Deploys contracts to Stellar Testnet and updates `deployments/testnet.json`. |
| `pnpm lint:fix` | Runs `oxlint` and `oxfmt` across the monorepo. |
| `cd contracts && cargo test` | Runs Rust unit tests for the smart contracts. |

## Development Conventions

### State Management & Sync
*  **Convex First:** Use Convex for application state and real-time updates. Avoid heavy client-side state where Convex queries can suffice.
*  **On-Chain Source of Truth:** The smart contracts are the ultimate source of truth for escrow and reputation.
*  **Sync Logic:** Use the sync actions in `packages/backend/convex/sync.ts` to reconcile local Convex state with on-chain status changes.

### Frontend Architecture
*  **Feature Slices:** Organize code into `apps/web/features/[feature-name]`.
*  **Core Helpers:** Stellar-specific logic (transaction building, contract invocation) should live in `apps/web/core/stellar`.
*  **Wallet Integration:** Use the hooks and providers in `apps/web/core/wallet` for all wallet-related operations, including Passkey Smart Accounts.

### Smart Contracts (Soroban)
*  **TTL Management:** Every contract entry-point should call `touch_instance` to extend the instance TTL.
*  **Auth Enforcement:** Strictly enforce `require_auth()`for all state-changing operations.
*  **Atomic Completion:** The `escrow` contract invokes the `reputation` contract's `record_completion` during the release phase.

### Code Quality
*  **Linting:** Adhere to `oxlint` rules. Always run `pnpm lint:fix` before committing.
*  **Formatting:** Use `oxfmt` for consistent styling.

## Security & Safety

*  **Credential Protection:** NEVER commit `.env.local` files or private keys.
*  **On-Chain Verification:** Always verify on-chain actions against the generated contract IDs in `deployments/testnet.json`.
*  **Signature Verification:** Authentication flows must use Ed25519 signature verification against Stellar public keys or Passkey-derived credentials.
