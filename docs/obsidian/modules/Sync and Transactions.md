---
type: module
area: integration
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Sync and Transactions

## Purpose

Record application transaction intent/status and reconcile selected escrow/reputation state from Stellar RPC into Convex.

## Current Status

Implemented as explicit browser-triggered transaction records plus action-driven sync. There is no historical chain indexer or all-wallet transaction backfill.

## Primary Locations

- `packages/backend/convex/transactions/`
- `packages/backend/convex/sync.ts`
- `packages/backend/convex/syncMutations.ts`
- `packages/backend/convex/lib/stellarReads.ts`
- `apps/web/features/marketplace/hooks/use-sync-actions.ts`
- `apps/web/core/stellar/transaction.ts`

## Responsibilities

- Store transaction type/status/hash, wallet type, fee path/source account, escrow/job/milestone links, asset/amount, and readable error text.
- Read `get_escrow` and `get_completion` through RPC simulation using a configured classic read source account.
- Normalize Soroban status/address/bytes values.
- Apply only safe forward escrow status changes and record sync failures.
- Insert a Convex reputation record once a released escrow has a readable completion record.

## Main Entry Points

Transactions: `createTransaction`, `updateTransactionStatus`, wallet/hash queries. Sync actions: `syncEscrowStatus`, `syncReputationRecord`. Internal mutations: `applyEscrowStatusSync`, `createReputationRecordFromSync`, `recordEscrowSyncFailure`.

## Data Model

`transactions` has `pending`, `success`, and `failed` statuses plus operation types such as create/fund/submit/release/record-reputation/cancel/mark-disputed/wallet-transfer. `escrows` stores sync metadata and per-operation hashes. `reputationRecords` is a Convex mirror of on-chain completion data.

## External Dependencies

Stellar RPC, `@stellar/stellar-sdk`, contract IDs, network passphrase, and `STELLAR_READ_SOURCE_ACCOUNT`.

## Internal Dependencies

Escrows, jobs, milestones, reputation, dashboard, and frontend hooks.

## Important Flows

```text
browser action → create pending tx record → direct Stellar call
  → update tx success/failed → patch Convex escrow/milestone/job
manual sync → RPC simulation → safe internal mutation
```

## Common Change Locations

Use `lib/stellarReads.ts` for RPC decoding/config; `sync.ts` for external reads and reasons; `syncMutations.ts` for safe local application; transaction schemas for new operation/fee types.

## Risks / Gotchas

- Terminal local statuses are protected against unsafe downgrades, but a failed sync still requires investigation.
- `STELLAR_READ_SOURCE_ACCOUNT` is a classic account used for simulation, not necessarily the product wallet or fee payer.
- The source explicitly marks `syncWalletTransactions(walletAddress)` post-MVP.

## Related Notes

[[architecture/Data Flow]], [[backend/Sync and Scheduled Jobs]], [[stellar/Transaction Lifecycle]], [[Current System State]]
