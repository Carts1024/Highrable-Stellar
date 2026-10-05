---
title: Highrable Instawards C21 — Dispute Retry and Reconciliation Evidence
type: delivery-evidence
status: verified
source_of_truth: packages/backend/tests/disputes/c21.reconciliation.test.ts and current backend source
---

# C21 — Dispute Retry and Reconciliation Evidence

## Result

C21 is implemented as focused `convex-test` integration coverage in
`packages/backend/tests/disputes/c21.reconciliation.test.ts`. The test-only fixtures add
network/contract-scoped dispute-admin membership and sibling milestone/escrow records.

No production backend defect was reproduced by the suite, so no Convex runtime or schema
change was required. Public arguments, return values, statuses, payment arithmetic,
authorization boundaries, and generated files are unchanged.

## Scenario coverage

| Area | Coverage |
| --- | --- |
| Marking retry | Hashless failure → retry → success; escrow/micro-gig or milestone mirror; historical failure event and single dispute preserved. |
| Known-hash recovery | Retry is blocked while a hash is known; conflicting success is rejected without writes; matching late success is accepted after mirror recovery. |
| Partial bookkeeping | Parent mirror can complete before the callback; success replay and stale failure leave confirmed state and side-effect counts unchanged. |
| Settlement retry | Failed operation remains recorded with its failed transaction while a new operation succeeds. |
| Uncertain settlement | Signed hash/expiry survive `submission_unknown`; competing operation is blocked; matching success and replay finalize once. |
| Parent outcomes | Client refund, freelancer payout, and split settlement cover micro-gigs and milestones, including hashes, terminal status, completion fields, transaction state, audit events, notifications, and messages. |
| Sibling isolation | Only the selected milestone changes; parent-job aggregation remains `funded`, `disputed`, or `completed` for active, disputed, and terminal siblings. |
| Sync boundaries | Internal sync records failure metadata, recovers to `disputed`, handles repeated reads, rejects terminal downgrades, and leaves finalization to administrator settlement. |
| Failure integrity | Unauthorized/conflicting callbacks preserve records; deleting a required milestone proves settlement writes roll back atomically. |

## Commands and results

Executed from the repository root unless noted:

```text
pnpm --filter @repo/backend exec vitest run tests/disputes/c21.reconciliation.test.ts
  1 file passed; 18 tests passed

pnpm --filter @repo/backend test
  8 files passed; 99 tests passed

cd packages/backend && pnpm exec tsc --project convex/tsconfig.json --noEmit
  passed

cd packages/backend && pnpm exec tsc --project tests/tsconfig.json --noEmit
  passed

pnpm --filter @repo/backend lint:fix
  passed; backend Convex lint, format, and source type-check passed

pnpm exec oxlint packages/backend/tests/fixtures/disputes.ts packages/backend/tests/disputes/c21.reconciliation.test.ts
  passed

pnpm exec oxfmt --check packages/backend/tests/fixtures/disputes.ts packages/backend/tests/disputes/c21.reconciliation.test.ts
  passed; both files use the repository format
```

## Boundaries and remaining limitations

- This is deterministic in-memory bookkeeping coverage. It does not execute Stellar RPC,
  verify a live transaction, or prove deployed contract behavior.
- It does not add a reconciliation service, transaction indexer, migration, deployment,
  frontend behavior, Soroban changes, or environment changes.
- Caller-supplied participant wallets retain the existing possession-proof limitation.
- Administrator coverage continues to use the configured wallet plus Convex secret and
  scoped membership/assignment checks.
