---
type: reference
area: backend
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Sync and Scheduled Jobs

## Chain-read synchronization

`packages/backend/convex/sync.ts` exposes two actions:

- `syncEscrowStatus({ escrowId })` loads the configured Stellar read settings, reads `get_escrow` from the escrow contract, normalizes the Soroban status, and calls an internal mutation to apply the result or record a failure.
- `syncReputationRecord({ escrowId })` reads `get_completion`, normalizes client/freelancer addresses and the optional review hash, then calls an internal mutation to create the Convex reputation mirror.

`packages/backend/convex/lib/stellarReads.ts` performs the RPC simulation/read work. It requires the configured network, RPC URL, escrow contract, reputation contract, and read source account. It normalizes Soroban addresses, byte arrays, and escrow statuses at the boundary.

`packages/backend/convex/syncMutations.ts` applies safe status changes, records last-sync metadata, updates linked milestones/jobs, and only creates a reputation mirror for a released escrow. It also protects terminal states such as `released`, `cancelled`, and `disputed` from unsafe regressions.

## Scheduling

`packages/backend/convex/crons.ts` registers one recurring job:

| Job | Schedule | Target |
| --- | --- | --- |
| Scan deadline reminders | Every 15 minutes | `internal.deadlines.scanUpcomingDeadlines` |

The current cron is a reminder scanner, not a chain poller. There is no scheduled escrow/reputation sync and no event-driven indexer in the repository.

## Product-flow responsibility

The web application can initiate chain calls through the Stellar client layer, then use Convex mutations/actions to record the local phase. Sync is therefore action-driven and flow-coupled. A future indexer would need to define replay, idempotency, cursoring, contract-event support, historical transaction coverage, and conflict rules before replacing this model.

## Explicit gap

`syncWalletTransactions(walletAddress)` is marked post-MVP in `sync.ts`. The source says it will require historical Stellar transaction indexing through Horizon or a dedicated indexer. Do not claim that the `transactions` table is a complete wallet history.

See [[modules/Sync and Transactions]], [[data/State Machines]], and [[architecture/Data Flow]].
