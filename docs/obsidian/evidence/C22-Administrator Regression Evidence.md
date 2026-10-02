---
type: evidence
area: admin
status: current
last_updated: 2026-10-01
source_of_truth: repository
---

# C22 — Administrator Regression Evidence

## Scope

C22 adds mocked component/integration coverage for the protected administrator queue, dispute detail, and settlement coordinator. These tests use deterministic synthetic wallets, operation IDs, transaction hashes, isolated TanStack Query clients, mocked HTTP responses, and controllable Stellar callbacks. They are not live Stellar Testnet end-to-end evidence and do not prove deployed-contract readiness.

No public API, schema, contract, dependency, environment, or production authorization changes were made. The three pre-existing generated Convex changes were left untouched.

## Requirement mapping

| Requirement | Named coverage |
| --- | --- |
| Protected queue/detail reads stay blocked before verification, for wallet mismatch, and in passkey mode | `admin-protected-pages.integration.test.tsx`: `does not request protected queue data before session verification`; `does not request protected detail data before session verification`; `keeps both protected reads blocked when the signed session belongs to another wallet`; `does not check session or mount protected queue content in passkey mode`; `does not check session or mount protected detail content in passkey mode` |
| Page-level 401/403 failures remove protected content and cache | `admin-protected-pages.integration.test.tsx`: `removes cached protected queue data after a page-level 401`; `removes cached protected detail data after a page-level 403` |
| Wallet changes and disconnects cannot restore stale records | `admin-protected-pages.integration.test.tsx`: `cancels and removes old-wallet queue data before a late response can restore it`; `removes protected queue cache and content on disconnect` |
| Retryable reads do not write | `admin-protected-pages.integration.test.tsx`: `retries only retryable queue reads and performs no writes`; existing queue/detail invalid, missing, forbidden, empty, loading, and retry tests remain in `admin-disputes-page.test.tsx` and `admin-dispute-detail-page.test.tsx` |
| Preparation through final recording, accessible progress, disabled controls, duplicate-click protection, and explorer links | `admin-dispute-detail-page.test.tsx`: `renders coordinator phases, signed identity, explorer context, and blocks duplicate clicks` |
| Simulation/signing failure permits a new operation with a new identity | `admin-dispute-detail-page.test.tsx`: `executes a new operation after failure bookkeeping succeeds`; `allows a new operation after wallet signing rejection is recorded` |
| Verified failed outcome permits a refreshed retry | `admin-dispute-detail-page.test.tsx`: `permits a fresh chain attempt after a verified failed settlement outcome` |
| Signed-recording, submission, confirmation, and final-recording uncertainty preserve context and avoid another chain execution | `admin-dispute-detail-page.test.tsx`: `keeps signed context when identity recording fails and reconciles without resubmitting`; `reconciles submission uncertainty with the known hash and no second chain execution`; `reconciles confirmation uncertainty with the known hash and no second chain execution`; `recovers final-recording failure through reconciliation and refreshes terminal detail` |
| Pending and failed reconciliation remain recoverable without Stellar submission | `admin-dispute-detail-page.test.tsx`: `preserves recovery controls while blocking a new settlement attempt`; `reconciles a pending attempt without invoking Stellar execution`; `keeps reconciliation recoverable and never invokes Stellar on repeated recovery failure` |
| Read refresh failure is read-only after successful settlement | `admin-dispute-detail-page.test.tsx`: `offers a read-only retry after successful settlement recording cannot refresh detail` |
| Fixed and split bps boundaries, invalid-input preservation, and no execution on invalid input | `admin-dispute-detail-page.test.tsx`: `submits the settlement boundary resolved_client at  bps`; `submits the settlement boundary resolved_freelancer at  bps`; `submits the settlement boundary split_resolution at 1 bps`; `submits the settlement boundary split_resolution at 9999 bps`; existing `preserves invalid split input ... and blocks settlement`; `settlement-validation.test.ts`: boundary and text-preservation unit cases |

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm --filter web exec vitest run features/admin` | Pass — 7 files, 135 tests |
| `pnpm --filter web test` | Pass — 17 files, 211 tests |
| `pnpm --filter web build` | Pass — Next.js production build, TypeScript, static generation, and route output completed |
| `pnpm --filter web exec oxlint .` | Pass — 0 errors; 3 existing accessibility warnings in `features/disputes/components/open-dispute-dialog.tsx` |
| `pnpm --filter web exec tsc --noEmit` | Pass |
| `pnpm exec oxfmt --check apps/web/features/admin/admin-protected-pages.integration.test.tsx apps/web/features/admin/admin-dispute-detail-page.test.tsx` | Pass |
| `pnpm --filter web exec oxfmt --check .` | Existing limitation — 5 unrelated dispute files report formatting differences: `dispute-detail-panel.tsx`, `dispute-list.tsx`, `dispute-route-states.test.tsx`, `dispute-timeline.test.tsx`, `dispute-timeline.tsx` |

## Remaining limitations

The C22 suite mocks HTTP, wallet infrastructure, Stellar execution callbacks, and Convex mutation seams. It does not submit transactions, exercise deployed contracts, verify live Testnet explorer records, or establish production deployment readiness. The repository-wide formatter warnings/issues remain outside the administrator scope and were not rewritten.
