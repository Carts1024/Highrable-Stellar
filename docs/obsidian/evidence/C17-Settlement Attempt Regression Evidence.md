---
type: evidence
area: backend
status: current
last_updated: 2026-10-07
source_of_truth: repository
---

# Deliverable 2 C17 — Settlement Attempt Regression Evidence

## Scope

This is the regression-coverage follow-up to the earlier C17 settlement-record implementation hardening recorded on 2026-09-30. It exercises the existing administrator settlement callbacks through the real composed Convex schema and `convex-test` in-memory harness. It is local bookkeeping evidence only: server-side Stellar RPC verification remains responsible for establishing chain outcomes, and these callbacks do not prove live settlement, wallet possession, deployed contract behavior, or reconciliation service behavior.

No production mutation/helper, schema, generated API, frontend, wallet, contract, deployment, migration, payout-arithmetic, or external-service change was required. The final code diff is limited to `packages/backend/tests/disputes/c17.settlement.test.ts`.

## Harness and snapshot evidence

- Each case seeds a micro-gig or milestone escrow/job/parent directly, opens the dispute with the public Convex mutation, then directly patches the local settlement prerequisites to a disputed escrow and assigned administrator.
- Membership is seeded with synthetic network/contract-scoped administrator records. Environment values provide the synthetic platform owner, Convex secret, Stellar network, and escrow contract scope.
- `tests/setup.ts` supplies a deterministic fake clock. Replay and rejection assertions advance it before callbacks so accidental timestamp writes cannot be hidden by equal timestamps.
- Settlement snapshots include the selected dispute plus all disputes, escrow/job/milestone parent records, settlement attempts, transactions, dispute audit events, notifications, conversations, and messages.

## Requirement matrix

| C17 requirement | Regression coverage |
| --- | --- |
| Normalized operation identity and matching active-start replay | `normalizes operation identity, replays matching starts, and rejects conflicting terms` verifies trimming, note normalization, no-write replay, and conflicts in case, actor, resolution, share, and note. |
| Failed operation-ID reuse and fresh retry identity | `requires a new operation ID after definitive failure` rejects the failed ID and accepts a new one while retaining the failed attempt/transaction history. |
| One active attempt per escrow | `allows only one active attempt while the first attempt is %s` covers `started`, `signed`, `submission_unknown`, and compatibility `submitted`. `locks competing disputes that reference the same escrow while independent escrows proceed` covers cross-dispute escrow locking and independent escrow progress. |
| Signed identity | `fixes signed identity once and rejects missing or malformed callback identities` accepts normalized matching hash/expiry replays without writes, rejects conflicting identity, malformed hashes, invalid expiries, and all four missing-operation callbacks. |
| Phase guards and recovery | `guards unsigned success and uncertainty, unverified signed failure, and failed success` covers unsigned success/uncertainty, missing or conflicting reconciliation hashes, matching failure, and failed-attempt success rejection. Existing uncertainty coverage also preserves first identity/error and accepts matching late success. |
| Terminal replay idempotency | The outcome matrix `applies the %s %s mapping atomically` covers both parent types and all three outcomes. `keeps terminal success side effects stable across signed, uncertain, success, and failure replays` compares the complete snapshot after advancing the clock. |
| Secret, scope, assignment, initiating actor, and participant guards | `checks secret and scoped membership before replay paths or writes`, the existing `checks scope, assignment, ownership, and authorization on replay paths`, and `rejects %s as a participant on start and every callback replay path` cover server secret, active scope, assignment, initiating actor, owner recovery, and both participant wallets. |
| Terminal and escrow state guards | `rejects new settlement starts for terminal dispute status %s` covers all terminal review statuses. `rejects state-changing callbacks for a non-disputed escrow, including replay paths` covers start, signed identity replay, uncertainty, success, and failure against a non-disputed escrow. |
| Atomicity and side effects | Existing outcome, failure, legacy-reference, and rollback coverage is retained. Rejected paths compare full snapshots; accepted outcomes assert escrow/parent/transaction bookkeeping and single audit, notification, conversation, and message side-effect sets. |

## Validation results

All commands passed on 2026-10-07:

- Focused C17: 32 tests in 1 file.
- Focused C17 + existing C21 reconciliation: 50 tests in 2 files.
- `pnpm --filter @repo/backend test`: 330 tests in 12 files.
- Backend TypeScript: `pnpm --filter @repo/backend exec tsc --project convex/tsconfig.json --noEmit`.
- Test TypeScript: `pnpm --filter @repo/backend exec tsc --project tests/tsconfig.json --noEmit`.
- Scoped oxlint: C17 tests plus settlement admin mutations/helpers.
- Scoped oxfmt check: C17 test file.
- `git diff --check`.

The full-suite total increased from the earlier 312-test baseline to 330 because of this coverage expansion. No demonstrated production violation was found, so no runtime fix was made.

## Boundaries

The tests prove deterministic Convex state transitions and side-effect idempotency. They do not prove live RPC submission/confirmation, Stellar signature validity, wallet possession, deployed contract IDs, contract membership deployment, payment precision, frontend coordinator behavior, or Deliverable 2 C19 reconciliation expansion.
