---
type: module
area: integration
status: current
last_updated: 2026-10-15
source_of_truth: repository
---

# Sync and Transactions

## Purpose

Record application transaction intent/status and reconcile selected escrow/reputation/registry state from Stellar RPC into Convex.

## Current Status

Implemented as explicit browser-triggered transaction records plus action-driven sync. Registry membership is read from the configured contract and mirrored by scope before new onboarding can complete. There is no historical chain indexer or all-wallet transaction backfill.

## Primary Locations

- `packages/backend/convex/transactions/`
- `packages/backend/convex/sync.ts`
- `packages/backend/convex/syncMutations.ts`
- `packages/backend/convex/lib/stellarReads.ts`
- `packages/backend/convex/lib/registryReads.ts`
- `packages/backend/convex/registry/`
- `apps/web/features/marketplace/hooks/use-sync-actions.ts`
- `apps/web/core/stellar/transaction.ts`

## Responsibilities

- Store transaction type/status/hash, wallet type, fee path/source account, escrow/job/milestone links, asset/amount, and readable error text.
- Track `register_user` transactions with the registry contract/network scope, transaction-valid-until time, and `transaction` versus `inner_transaction` identity. Velo/passkey inner hashes remain available for bookkeeping and are not treated as confirmed outer transaction IDs.
- Read and normalize `get_registration` plus `is_registered`; only the backend RPC action can update the `registryRegistrations` mirror.
- Read `get_escrow` and `get_completion` through RPC simulation using a configured classic read source account.
- Normalize Soroban status/address/bytes values.
- Apply only safe forward escrow status changes and record sync failures.
- Insert a Convex reputation record once a released escrow has a readable completion record.

## Main Entry Points

Transactions: `createTransaction`, `updateTransactionStatus`, wallet/hash queries, and scoped `getRegistryTransaction`. Sync actions: `syncEscrowStatus`, `syncReputationRecord`, `syncUserRegistration`. Internal mutations: `applyEscrowStatusSync`, `createReputationRecordFromSync`, `recordEscrowSyncFailure`, and `applyVerifiedRegistration`.

## Data Model

`transactions` has `pending`, `success`, and `failed` statuses plus operation types such as create/fund/submit/release/record-reputation/cancel/mark-disputed/wallet-transfer/register-user. Registration rows are scoped by network, contract, and wallet. `escrows` stores sync metadata and per-operation hashes. `reputationRecords` and `registryRegistrations` mirror RPC-verified on-chain records.

## External Dependencies

Stellar RPC, `@stellar/stellar-sdk`, contract IDs, network passphrase, and `STELLAR_READ_SOURCE_ACCOUNT`.

## Internal Dependencies

Escrows, jobs, milestones, reputation, dashboard, and frontend hooks.

## Important Flows

```text
browser action → create pending tx record → direct Stellar call
  → update tx success/failed → patch Convex escrow/milestone/job
manual sync → RPC simulation → safe internal mutation
signup → profile draft → scoped registry RPC read → internal mirror → onboarding completion
```

## Common Change Locations

Use `lib/stellarReads.ts` and `lib/registryReads.ts` for independent RPC decoding/config; `sync.ts` for external reads and reasons; `syncMutations.ts` and `registry/mutations.ts` for safe local application; transaction schemas for new operation/identity/fee types.

Deliverable 2 C19 validates decoded escrow/completion IDs against the requested u64 ID, Stellar addresses, integer bounds, 32-byte hashes, status encodings, and completion ratings. Missing completion data remains distinct from a malformed record. A failed escrow read records failure metadata while preserving parent state; a valid retry can reconcile to disputed and clear that error. Generic sync still cannot finalize disputed escrow. See `docs/instawards/Deliverable-2-C19-RPC-Recovery-Evidence.md` for local RPC-mocked and Convex action coverage.

Deliverable 3 C18 interleaves real participant marking callbacks with RPC-mocked `syncEscrowStatus` reads. Failed, successful disputed-state, and repeated reads may change sync metadata and mirror safe parent status, but they do not write dispute confirmation data, marking side effects, transaction hashes, or release/cancellation finalization. Callback-before-sync and sync-before-callback orders remain separate; only the marking success callback confirms the dispute bookkeeping.

## Risks / Gotchas

- Terminal local statuses are protected against unsafe downgrades, but a failed sync still requires investigation.
- `STELLAR_READ_SOURCE_ACCOUNT` is a classic account used for simulation, not necessarily the product wallet or fee payer.
- The source explicitly marks `syncWalletTransactions(walletAddress)` post-MVP.

## Related Notes

[[architecture/Data Flow]], [[backend/Sync and Scheduled Jobs]], [[stellar/Transaction Lifecycle]], [[Current System State]]
