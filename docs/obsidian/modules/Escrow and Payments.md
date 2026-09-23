---
type: module
area: escrow
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Escrow and Payments

## Purpose

Coordinate product-level jobs/milestones with token-backed Soroban escrow calls and Convex mirror records.

## Current Status

Core escrow lifecycle is implemented in both the Rust contract and web execution layer. Production readiness still depends on correct deployment/configuration, asset allowlisting, wallet funding, and operational verification.

## Primary Locations

- Contract: `contracts/escrow/src/lib.rs`, `contracts/escrow/src/test.rs`
- Convex: `packages/backend/convex/escrows/`, `milestones/`, `transactions/`
- Frontend: `apps/web/core/stellar/escrow-contract.ts`, `transaction.ts`, `transactionExecutor.ts`
- Feature hooks: `apps/web/features/marketplace/hooks/use-escrow-actions.ts`, `use-milestone-escrow-actions.ts`, `use-sync-actions.ts`

## Responsibilities

- Build Soroban calls using raw token units and 32-byte hashes.
- Execute through external wallet or passkey smart account.
- Recover escrow IDs when a smart-account wrapper does not return the inner `u64`.
- Store Convex escrow rows, operation tx hashes, job/milestone linkage, and sync metadata.
- Keep agreement acceptance and dispute guards in the product workflow.

## Main Entry Points

On chain: `create_escrow`, `create_open_escrow`, `create_and_fund_open_escrow`, `fund_escrow`, `assign_freelancer`, `submit_work`, `approve_and_release`, `cancel_escrow`, `mark_disputed`, and `resolve_dispute`.

Frontend wrappers: `createEscrowOnChain`, `createOpenEscrowOnChain`, `createAndFundOpenEscrowOnChain`, `fundEscrowOnChain`, `assignFreelancerOnChain`, `submitWorkOnChain`, `approveAndReleaseOnChain`, `cancelEscrowOnChain`, `markDisputedOnChain`, `resolveDisputeOnChain`.

## Data Model

Convex `escrows` stores `escrowId` as a string, job/milestone IDs, wallets, amount/asset, status, per-operation tx hashes, timestamps, and `lastSync*` fields. The contract stores `TEscrow` with client, optional freelancer, asset, amount, `job_hash`, optional proof hash, status, and timestamps.

## External Dependencies

Soroban RPC, configured token/SAC contracts, Stellar Wallets Kit, `smart-account-kit`, passkey/WebAuthn, and optional relayer/source-account fee paths.

## Internal Dependencies

Jobs, milestones, work agreements, work submissions, disputes/cancellations, reputation, transactions, and payment-asset configuration.

## Important Flows

```text
create → fund → assign if open → submit work → approve/release
                              ↘ cancel (created/funded only)
funded/submitted → mark disputed → admin resolve with freelancer share bps
```

Release transfers the configured token from the escrow contract to the freelancer and calls reputation. Dispute settlement splits/refunds escrow funds but does not call reputation.

## Common Change Locations

Contract behavior belongs in Rust first. Frontend call arguments/fee paths belong in `core/stellar/escrow-contract.ts` and the executors. Convex mirror transitions belong in `escrows/mutations.ts`, `milestones/helpers.ts`, and `syncMutations.ts`.

## Risks / Gotchas

- The contract enforces an allowlist only once at least one allowed asset exists; deployment scripts add configured assets.
- Amounts are human units in UI/Convex inputs but token raw units (`i128`) on chain.
- Convex status updates are not the same as chain confirmation; retain tx hashes and sync metadata.
- `resolve_dispute` accepts a resolution hash argument but the current contract names it `_resolution_hash` and does not store it.

## Related Notes

[[contracts/Escrow Contract]], [[stellar/Payment Assets and Path Payments]], [[stellar/Transaction Lifecycle]], [[modules/Sync and Transactions]]
