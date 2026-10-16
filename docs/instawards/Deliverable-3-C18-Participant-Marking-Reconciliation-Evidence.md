---
type: evidence
area: backend
status: verified-local
last_updated: 2026-10-15
source_of_truth: repository
---

# Deliverable 3 C18 — Participant Marking Reconciliation Evidence

## Scope

C18 hardens the existing Convex participant marking flow without changing public arguments, boolean returns, statuses, schemas, indexes, generated APIs, frontend behavior, Stellar contracts, or deployment configuration.

- A new start from `not_marked` is rejected when a transaction hash is already stored, with reconciliation guidance. The existing `mark_failed` known-hash guard and error text remain unchanged.
- Authorization and argument sanitization still run before replay returns. Duplicate `marking` starts remain write-free acknowledgments and do not authorize resubmission.
- Matching success remains idempotent; conflicting hashes reject; late matching success recovers a failure; stale failures cannot overwrite confirmation.
- `c18.marking-reconciliation.test.ts` covers both micro-gig and milestone parents, both participant roles, external-wallet/passkey actor bookkeeping, complete callback snapshots, exact event/message/notification counts, terminal and invalid-argument guards, sibling isolation, and RPC-mocked sync interleavings.

## Regression coverage

The focused suite contains 23 cases. Its matrix verifies:

- Stored hashes in `not_marked`, `marking`, and `mark_failed`; rejected retries; duplicate starts; preserved hashes, URLs, timestamps, metadata, and complete records.
- Hashless failure, late hash enrichment, matching late success, conflicting callbacks, repeated success, and stale failure replay with single-write side effects.
- Unauthorized callback replays, blank callback arguments, terminal replay boundaries, and milestone sibling-case isolation.
- Failed RPC reads, successful `disputed` reads, repeated reads, and callback-before-sync/sync-before-callback ordering through the real `syncEscrowStatus` action.
- Sync metadata may update, but sync never submits a transaction, invents a hash, confirms the dispute callback, or releases/cancels/finalizes the disputed escrow.

## Validation results

All final commands were run locally on 2026-10-15 in the repository checkout:

| Check | Result |
| --- | --- |
| `pnpm --filter @repo/backend exec vitest run tests/disputes/c18.marking-reconciliation.test.ts` | 23 passed in 1 file |
| `pnpm --filter @repo/backend test` | 479 passed across 16 files |
| `pnpm --filter @repo/backend exec tsc --project convex/tsconfig.json --noEmit` | passed |
| `pnpm --filter @repo/backend exec tsc --project tests/tsconfig.json --noEmit` | passed |
| `pnpm --filter @repo/backend exec oxlint convex/disputes/mutations.ts tests/disputes/c18.marking-reconciliation.test.ts` | passed |
| `pnpm --filter @repo/backend exec oxfmt --check convex/disputes/mutations.ts tests/disputes/c18.marking-reconciliation.test.ts` | passed |
| `git diff --check` | passed |

The test runner emitted existing Vite CommonJS/native-loader and Node localStorage experimental warnings; they did not fail a test or check.

## Boundaries

This is local `convex-test`, mocked Stellar RPC, and TypeScript/lint/format evidence. It does not prove caller-supplied wallet possession, live Convex deployment behavior, live Testnet execution, transaction signing/submission, chain confirmation, deployed Soroban behavior, or notification delivery. Hashless failures remain retryable only when the caller knows submission did not occur; existing callbacks have no attempt identifiers and cannot distinguish all stale hashless attempts. No reconciliation service or recovery API was added, and no frontend, contract, deployment, environment, migration, or generated-file change was made.
