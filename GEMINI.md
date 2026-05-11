# Highrable | Project Instructions

Highrable is a Stellar-native freelance marketplace combining Soroban smart-contract escrow with wallet-first user flows and verifiable on-chain reputation.

## Project Overview

Highrable uses a trust-by-contract model where client and freelancer terms are managed via on-chain escrows. The system is built as a monorepo with three primary layers:

1.  **Soroban Smart Contracts (Rust):**
    *   `contracts/escrow`: Manages the lifecycle of work escrows (funding, submission, release, disputes).
    *   `contracts/reputation`: Records immutable completion data and aggregate freelancer stats.
2.  **Backend State Layer (Convex):**
    *   `packages/backend`: Fast application state mirror and transaction history.
    *   Reconciles on-chain state from Stellar RPC with local database records via sync actions.
3.  **Frontend (Next.js 16 / React 19):**
    *   `apps/web`: Wallet-first UX using Stellar Wallets Kit.
    *   Feature-sliced architecture: `landing`, `marketplace`, `jobs`, `dashboard`.

## Technical Stack

*   **Monorepo:** `pnpm`, `turbo`.
*   **Frontend:** Next.js 16, React 19, `@stellar/stellar-sdk`, `@creit-tech/stellar-wallets-kit`, `convex`, `@tanstack/react-query`, `framer-motion`, `lucide-react`.
*   **Backend:** Convex (Serverless functions).
*   **Smart Contracts:** Soroban SDK v22 (Rust).
*   **Tooling:** `oxlint` (linting), `oxfmt` (formatting), `husky`.

## Key Commands

### Development
*   `pnpm dev`: Runs the Next.js web app and Convex backend concurrently.
*   `pnpm build`: Builds all packages and applications.

### Smart Contracts
*   `pnpm contracts:build`: Builds Soroban contracts using `stellar contract build`.
*   `cd contracts && cargo test`: Runs Rust unit tests for contracts.
*   `pnpm contracts:deploy:testnet`: Deploys contracts to Stellar Testnet and updates `deployments/testnet.json`.

### Linting & Formatting
*   `pnpm lint:fix`: Runs `oxlint` and `oxfmt` across the monorepo.

## Project Structure

*   `apps/web`: Next.js application (Port 3000).
*   `packages/backend`: Convex schema and functions.
*   `packages/convex-client`: Shared Convex API bindings.
*   `packages/ui`: Shared UI components and global styles.
*   `contracts/`: Soroban/Rust smart contracts.
*   `deployments/`: Contains deployment artifacts (e.g., `testnet.json`).
*   `scripts/`: Deployment and verification shell scripts.

## Development Conventions

*   **State Management:** Use Convex for application state and real-time updates. Avoid heavy client-side state where Convex queries can suffice.
*   **Blockchain Interaction:** Use `@stellar/stellar-sdk` for transaction building and Soroban invocations.
*   **UI Components:** Prefer shared components from `@repo/ui`.
*   **Linting:** Adhere to `oxlint` rules. Always run `pnpm lint:fix` before committing.
*   **Sync Logic:** On-chain to Convex reconciliation should be handled in `packages/backend/convex/sync.ts` using safe status progression.

## Security & Safety

*   Never commit secrets or private keys. Use `.env.local` for local development.
*   Verify all on-chain actions against the generated `deployments/testnet.json` contract IDs.
