---
type: evidence
area: admin
status: current
last_updated: 2026-10-14
source_of_truth: repository
---

# Deliverable 3 C15 — Review-State Propagation Evidence

## Scope

Added `apps/web/features/admin/admin-review-propagation.integration.test.tsx` on branch `instawards/dev/bette`. The test is administrator-owned mocked frontend integration coverage. It uses the real administrator session gate, administrator API client and review controls, participant detail panel, shared status badge, and participant timeline. It keeps administrator, client, and freelancer wallet contexts independent and derives the canonical case/event fixtures from `@repo/convex-client` types.

The harness covers client-opened micro-gig and freelancer-opened milestone cases, both participant viewers, and the shared statuses `under_review`, `awaiting_client_response`, and `awaiting_freelancer_response`. Accepted transitions assert the exact raw request status, refreshed administrator result, participant query result, readable labels, case/event IDs, administrator wallet, `moderator` role, external wallet type, message, timestamp, and old/new status. Custom and backend-default messages preserve earlier timeline history.

The test publishes wallet-scoped Convex subscription fixtures explicitly after simulated accepted writes. Pending, duplicate, rejected, 401, and 403 paths do not publish participant changes. Successful writes followed by a failed administrator refresh leave the participant subscription able to show the saved status and let the administrator retry reads without repeating the write. Review-state changes remain separate from escrow marking and settlement; the test records no signing, Stellar submission, settlement, or Convex mutation call.

## Validation performed

Commands were run from the repository root. Windows process-spawn failures for Vitest and the first build attempt were environmental `spawn EPERM` failures; the affected commands were rerun with elevated process permissions.

| Check | Result |
| --- | --- |
| `pnpm --filter web exec vitest run features/admin/admin-review-propagation.integration.test.tsx --maxWorkers=1 --minWorkers=1` | 1 file, 11 tests passed |
| `pnpm --filter web exec vitest run features/admin --maxWorkers=1 --minWorkers=1` | 9 files, 261 tests passed |
| `pnpm --filter web exec vitest run features/disputes/components/dispute-participant-integration.test.tsx features/disputes/components/dispute-timeline.test.tsx --maxWorkers=1 --minWorkers=1` | 1 file passed; 15 passed and 2 failed tests. The two failures are the independently reproduced historical D2 C24 assertions below. |
| `pnpm --filter web exec vitest run --maxWorkers=1 --minWorkers=1` | 27 files passed, 1 file failed; 438 passed and 2 failed tests out of 440. The new C15 file passed in this run. |
| `pnpm --filter web exec tsc --noEmit` | Passed |
| `pnpm exec oxlint apps/web/features/admin/admin-review-propagation.integration.test.tsx` | Passed: 0 warnings, 0 errors |
| `pnpm exec oxfmt --check apps/web/features/admin/admin-review-propagation.integration.test.tsx` | Passed |
| `git diff --check` | Passed |
| `pnpm --filter web build` | Passed with elevated process permissions; Next.js compiled, type-checked, generated 24 static pages, and finalized route optimization |

## Independently reproduced historical participant failures

The relevant participant detail/timeline regression was run directly and as part of the full web suite. Both failures remain in `apps/web/features/disputes/components/dispute-participant-integration.test.tsx` and are outside the administrator-only C15 change:

- Line 880, `D2 C24 follows denied access, participant submissions, uncertain marking and authoritative recovery as one journey`, expects `Escrow dispute marking is confirmed on Stellar.` but the current rendered state is `Chain: Outcome Pending`.
- Line 919, `D2 C24 keeps confirmed parent-recording failures recoverable when the case already reports marked`, expects the same obsolete copy but the current rendered state is `Chain: Recording Confirmation`, with the recoverable parent-recording error.

The existing participant timeline test passed. No participant source file was changed.

## Evidence boundary

This report proves mocked browser/UI/API/subscription coordination and regression behavior around the frozen contract. It does not prove live Convex propagation, backend audit or notification atomicity, Convex authorization, wallet possession, Stellar signing, Testnet execution, deployed contract compatibility, or settlement behavior.

No production source, generated types, schemas, backend authorization, participant implementation, wallet behavior, contract, deployment, or environment configuration was changed. The branch was not committed, pushed, or deployed.
