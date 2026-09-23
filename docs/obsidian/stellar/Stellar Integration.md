---
type: reference
area: stellar
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Stellar Integration

Highrable uses both classic Stellar account flows and Soroban contract flows. The web client is responsible for building, simulating, signing, submitting, and confirming user-initiated transactions. Convex performs bounded server-side contract reads and mirrors selected results into application state.

## Contract boundary

`apps/web/core/stellar/escrow-contract.ts` wraps the escrow contract methods for create, fund, assignment, submission, release, cancellation, dispute marking, dispute resolution, and reads. `apps/web/core/stellar/transactionExecutor.ts` selects the external-wallet or passkey-smart-account execution path.

The current deployed contract metadata is recorded in `deployments/testnet.json` and `deployments/mainnet.json`; see [[contracts/Deployment Artifacts]]. The Rust authority is [[contracts/Escrow Contract]] and [[contracts/Reputation Contract]].

## Transport boundary

- Soroban RPC is used for contract simulation, preparation, submission, confirmation, and read-only simulation calls.
- Horizon is used by classic wallet helpers for account balances, trustline checks, and path-payment transactions.
- The network passphrase must match the selected network for every built transaction.
- Contract IDs, token configuration, RPC, Horizon, and passphrase are validated from environment-backed config.

## Current integration limits

- The contracts do not currently publish explicit application events.
- Convex synchronization reads contract state on demand; it is not a general RPC/Horizon indexer.
- Historical wallet transaction indexing is not implemented.
- A successful readiness check does not prove that the external relayer, contracts, or production operations are audited.

See [[stellar/Transaction Lifecycle]], [[stellar/Wallet Identity Model]], [[stellar/Network Configuration]], and [[modules/Sync and Transactions]].
