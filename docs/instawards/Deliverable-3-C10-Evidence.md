---
type: evidence
area: backend
status: verified-locally
last_updated: 2026-10-14
source_of_truth: repository
---

# Deliverable 3 C10 — Evidence Association and Protected Reads

## Outcome

C10 hardens the existing Convex dispute workflow without changing public function names, arguments, result shapes, statuses, schemas, indexes, or legacy optional-link compatibility. Current-work access is resolved from the saved dispute and its current parent/participant graph. Terminal reads remain available when that graph still matches; reassignment, deleted parents, contradictory links, and revoked case associations fail closed. Active evidence/response writes remain status-restricted.

Protected context reads return `null` before protected context loading for omitted, blank, or unrelated viewers. Submissions, revisions and their linked submissions, and deadlines are validated against the resolved work and invalid records are omitted. Case and timeline attachments require active exact-dispute association and a valid participant uploader role before viewer/uploader shortcuts, including preview, download, and direct upload paths. Administrator secret, capability, and scope checks remain in place, with invalid historical attachments omitted. `addDisputeEvidence` passes validated, first-seen deduplicated IDs into attachment reassignment.

## Source and test mapping

| Acceptance area | Source mapping | Focused regression |
| --- | --- | --- |
| Central current-work authorization and terminal/reassignment semantics | [`disputes/helpers.ts`](../../packages/backend/convex/disputes/helpers.ts), [`disputes/queries.ts`](../../packages/backend/convex/disputes/queries.ts), [`disputes/mutations.ts`](../../packages/backend/convex/disputes/mutations.ts) | [`c10.protected-reads.test.ts`](../../packages/backend/tests/disputes/c10.protected-reads.test.ts): terminal history, reassignment, deleted/conflicting parents, role/wallet matrix |
| Protected context reads and exact related-record validation | [`disputes/queries.ts`](../../packages/backend/convex/disputes/queries.ts), existing validation helpers | [`c10.protected-reads.test.ts`](../../packages/backend/tests/disputes/c10.protected-reads.test.ts): anonymous/unrelated viewers, conflicting submissions/revisions, sibling/exact deadline parents; existing C08/C09 regressions retain hidden-message and conversation-membership coverage |
| Case/timeline attachment association and direct access | [`attachments/helpers.ts`](../../packages/backend/convex/attachments/helpers.ts), [`disputes/queries.ts`](../../packages/backend/convex/disputes/queries.ts) | [`c10.protected-reads.test.ts`](../../packages/backend/tests/disputes/c10.protected-reads.test.ts): same-case/cross-case, deleted/missing/expired/protected evidence, revocation, preview/download/upload |
| Administrator historical review | [`admin/queries.ts`](../../packages/backend/convex/admin/queries.ts) | [`c10.protected-reads.test.ts`](../../packages/backend/tests/disputes/c10.protected-reads.test.ts): authorized historical review and invalid case attachments |
| Limits, deduplication, atomicity, audit/notification behavior | [`disputes/mutations.ts`](../../packages/backend/convex/disputes/mutations.ts), [`tests/fixtures/disputes.ts`](../../packages/backend/tests/fixtures/disputes.ts) | [`c10.protected-reads.test.ts`](../../packages/backend/tests/disputes/c10.protected-reads.test.ts): raw 25 boundary, repeated IDs, cumulative requests, complete snapshots including attachment access logs; existing C08 coverage retains the raw 20 reference boundary |

The focused file uses the existing dispute fixtures and covers both participant roles, external/passkey wallet types, micro-gig/milestone parents, explicit escrow/job aliases, same-wallet separate cases, reassignment, missing/deleted parents, and protected historical evidence. The existing C08/C09 regressions retain the full related-reference matrix and raw 20 reference boundary.

## Verification commands and results

- `pnpm --filter @repo/backend exec vitest run tests/disputes/c10.protected-reads.test.ts` — 1 file, 13 tests passed.
- `pnpm --filter @repo/backend exec vitest run tests/disputes/c05.authorization.test.ts tests/disputes/c08.evidence.test.ts tests/disputes/c19.participant-evidence.test.ts` — 3 files, 140 tests passed.
- `pnpm --filter @repo/backend test` — 14 files, 381 tests passed.
- `pnpm --filter @repo/backend exec tsc --project convex/tsconfig.json --noEmit` — passed.
- `pnpm --filter @repo/backend exec tsc --project tests/tsconfig.json --noEmit` — passed.
- `pnpm exec oxlint packages/backend/convex packages/backend/tests/disputes/c10.protected-reads.test.ts packages/backend/tests/fixtures/disputes.ts` — passed.
- `pnpm exec oxfmt --check packages/backend/convex packages/backend/tests/disputes/c10.protected-reads.test.ts packages/backend/tests/fixtures/disputes.ts` — passed.
- `git diff --check` — passed.

No live deployment, migration, frontend, generated-file, Stellar transaction, or contract validation was performed.

## Local-test limitations

`convex-test` exercises the in-memory Convex functions and fixtures. It does not prove possession of a caller-supplied wallet identity, signed-session enforcement for public participant functions, live Convex deployment behavior, real storage availability/URLs, wallet signing, Stellar RPC, contract compatibility, or transaction submission. Administrator tests use local secret/capability fixtures. A direct attachment ID read has no caller-supplied case ID; exact cross-case isolation is enforced where the dispute or timeline context is available, while dispute-linked preview/download/upload paths validate the resolved case association.
