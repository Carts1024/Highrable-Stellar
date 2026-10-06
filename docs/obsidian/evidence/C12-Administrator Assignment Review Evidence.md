---
type: evidence
area: admin
status: current
last_updated: 2026-10-06
source_of_truth: repository
---

# Deliverable 2 C12 - Administrator Assignment and Review Evidence

## Scope

C12 hardens the existing admin queue/detail claim, assignment, and review-status controls. It does not change the endpoints, Convex authorization, audit or notification side effects, schema, generated files, wallet behavior, environment configuration, contracts, deployments, or Stellar transactions.

## Acceptance mapping

| Acceptance area | Evidence |
| --- | --- |
| Claim, assignment, and review permission checks | Queue/detail tests cover participant conflicts, terminal claims, owner-only assignment, assigned-admin review, nonterminal guards, normalized wallet comparisons, and handler-side rejection. |
| Assignee availability | Tests cover wallet deduplication, participant exclusion, inactive historical assignees as disabled options, membership loading/error states, and assignment readiness only after a successful membership read. |
| Settlement lock boundary | Detail tests disable reassignment for active `started`, `signed`, `submission_unknown`, and `submitted` attempts while preserving terminal-case owner reassignment. |
| Mutation behavior | Tests assert exact claim/assignment/status payloads, rapid duplicate protection, overlapping-action protection, backend assignment conflicts, preserved review drafts, and the existing 4,000-character review-message limit. |
| Refresh and cache behavior | Tests assert invalidation of all queue filters and the affected detail cache, refreshed assignment/status data, no optimistic status/assignment updates, and read-only retry after a successful write followed by a failed read. |
| Authorization and identity boundaries | Real session-gate integration covers mutation 401/403 responses, protected-cache eviction, and late queue/detail responses after wallet changes. |
| Accessibility feedback | Pending, success, conflict/error, membership, settlement-lock, and retry feedback use accessible status/alert semantics or labeled controls. |

## Commands and results

- `pnpm --filter web exec vitest run features/admin --reporter=dot` — passed, 7 files / 190 tests.
- `pnpm --filter web test -- --reporter=dot` — passed, 23 files / 303 tests.
- `pnpm --filter web exec tsc --noEmit` — passed.
- `pnpm exec oxlint apps/web/features/admin/admin-dispute-detail-page.tsx apps/web/features/admin/admin-dispute-detail-page.test.tsx apps/web/features/admin/admin-disputes-page.tsx apps/web/features/admin/admin-disputes-page.test.tsx apps/web/features/admin/admin-protected-pages.integration.test.tsx apps/web/features/admin/components/admin-operations-ui.tsx apps/web/features/admin/lib/assignment-validation.ts apps/web/features/admin/lib/admin-query-cache.ts` — passed, 0 warnings / 0 errors.
- `pnpm exec oxfmt --check apps/web/features/admin/admin-dispute-detail-page.tsx apps/web/features/admin/admin-dispute-detail-page.test.tsx apps/web/features/admin/admin-disputes-page.tsx apps/web/features/admin/admin-disputes-page.test.tsx apps/web/features/admin/admin-protected-pages.integration.test.tsx apps/web/features/admin/components/admin-operations-ui.tsx apps/web/features/admin/lib/assignment-validation.ts apps/web/features/admin/lib/admin-query-cache.ts` — passed, all 8 files formatted.
- `pnpm --filter web build` — passed; Next.js production build compiled, type-checked, generated 24 routes, and finalized successfully.

## Limitations

This is mocked component, API, and session-gate evidence. It does not claim live deployment, live Convex authorization, wallet signatures, Stellar RPC behavior, contract behavior, on-chain membership, transaction execution, or production-chain verification. Backend policy remains authoritative and unchanged, including owner reassignment of terminal cases.
