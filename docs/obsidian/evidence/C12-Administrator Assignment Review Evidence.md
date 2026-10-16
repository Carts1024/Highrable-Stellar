---
type: evidence
area: admin
status: current
last_updated: 2026-10-14
source_of_truth: repository
---

# Deliverable 2 C12 - Administrator Assignment and Review Evidence

## Scope

### 2026-10-14 follow-up — case-local action state

The detail content is now keyed by dispute ID. Navigating to another case discards the previous case's pending action state, feedback, and drafts. An already-issued request may finish for its original case, but its completion cannot disable the replacement case, clear its draft, or show an unrelated success/conflict there. Backend authorization and wallet-scoped cache invalidation remain authoritative.

Two deferred-response regressions (success and HTTP 409) initially failed because the replacement case inherited the pending review lock. Both pass after the change and verify the new draft and feedback remain isolated. The administrator detail suite passes 84 tests; combined administrator/participant suites pass 327 tests across 17 files. Verification uses mocked session/API execution, not a live administrative session.

C12 hardens the existing admin queue/detail claim, assignment, and review-status controls. It does not change the endpoints, Convex authorization, audit or notification side effects, schema, generated files, wallet behavior, environment configuration, contracts, deployments, or Stellar transactions.

## Acceptance mapping

Follow-up validation: the full web suite passes **429 tests across 27 files** with `NODE_OPTIONS=--no-experimental-webstorage` and `vitest run --maxWorkers=2 --minWorkers=1`; without that Node 25 compatibility option, nine wallet-client tests fail at `localStorage.clear`. Web TypeScript and scoped formatting pass. Scoped lint exits successfully with two existing `react(set-state-in-effect)` warnings in the administrator detail page. `pnpm lint:fix` cannot start because the machine's pnpm launcher points to a missing executable; installed workspace binaries were used. No live API or chain verification was performed.

| Acceptance area                                 | Evidence                                                                                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claim, assignment, and review permission checks | Queue/detail tests cover participant conflicts, terminal claims, owner-only assignment, assigned-admin review, nonterminal guards, normalized wallet comparisons, and handler-side rejection.                                    |
| Assignee availability                           | Tests cover wallet deduplication, participant exclusion, inactive historical assignees as disabled options, membership loading/error states, and assignment readiness only after a successful membership read.                   |
| Settlement lock boundary                        | Detail tests disable reassignment for active `started`, `signed`, `submission_unknown`, and `submitted` attempts while preserving terminal-case owner reassignment.                                                              |
| Mutation behavior                               | Tests assert exact claim/assignment/status payloads, rapid duplicate protection, overlapping-action protection, backend assignment conflicts, preserved review drafts, and the existing 4,000-character review-message limit.    |
| Refresh and cache behavior                      | Tests assert invalidation of all queue filters and the affected detail cache, refreshed assignment/status data, no optimistic status/assignment updates, and read-only retry after a successful write followed by a failed read. |
| Authorization and identity boundaries           | Real session-gate integration covers mutation 401/403 responses, protected-cache eviction, and late queue/detail responses after wallet changes.                                                                                 |
| Accessibility feedback                          | Pending, success, conflict/error, membership, settlement-lock, and retry feedback use accessible status/alert semantics or labeled controls.                                                                                     |

## Commands and results

- `pnpm --filter web exec vitest run features/admin --reporter=dot` — passed, 7 files / 190 tests.
- `pnpm --filter web test -- --reporter=dot` — passed, 23 files / 303 tests.
- `pnpm --filter web exec tsc --noEmit` — passed.
- `pnpm exec oxlint apps/web/features/admin/admin-dispute-detail-page.tsx apps/web/features/admin/admin-dispute-detail-page.test.tsx apps/web/features/admin/admin-disputes-page.tsx apps/web/features/admin/admin-disputes-page.test.tsx apps/web/features/admin/admin-protected-pages.integration.test.tsx apps/web/features/admin/components/admin-operations-ui.tsx apps/web/features/admin/lib/assignment-validation.ts apps/web/features/admin/lib/admin-query-cache.ts` — passed, 0 warnings / 0 errors.
- `pnpm exec oxfmt --check apps/web/features/admin/admin-dispute-detail-page.tsx apps/web/features/admin/admin-dispute-detail-page.test.tsx apps/web/features/admin/admin-disputes-page.tsx apps/web/features/admin/admin-disputes-page.test.tsx apps/web/features/admin/admin-protected-pages.integration.test.tsx apps/web/features/admin/components/admin-operations-ui.tsx apps/web/features/admin/lib/assignment-validation.ts apps/web/features/admin/lib/admin-query-cache.ts` — passed, all 8 files formatted.
- `pnpm --filter web build` — passed; Next.js production build compiled, type-checked, generated 24 routes, and finalized successfully.

## Limitations

This is mocked component, API, and session-gate evidence. It does not claim live deployment, live Convex authorization, wallet signatures, Stellar RPC behavior, contract behavior, on-chain membership, transaction execution, or production-chain verification. Backend policy remains authoritative and unchanged, including owner reassignment of terminal cases.
