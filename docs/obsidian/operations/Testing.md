---
type: runbook
area: operations
status: current
last_updated: 2026-10-05
source_of_truth: repository
---

# Testing

## Test layers

| Layer | Command/location | Scope |
| --- | --- | --- |
| Web unit/component tests | `pnpm --filter web test` | Vitest suite under `apps/web`. |
| Backend Convex tests | `pnpm --filter @repo/backend test` | In-memory `convex-test` regression suite under `packages/backend/tests/`, using the real schema and explicit Convex module map. |
| Type/lint/build checks | `pnpm build`, `pnpm lint:fix` | Next build, TypeScript, oxlint/oxfmt through package scripts. |
| Soroban contract tests | `cd contracts && cargo test` | Escrow/reputation behavior using Soroban test utilities. |
| Deployment verification | `pnpm contracts:verify:testnet` | Live testnet wiring/admin/allowlist checks; requires Stellar CLI identity and network access. |

## Backend dispute regression harness

The C02 backend harness uses `convex-test` with the real composed schema from `packages/backend/convex/schema.ts`, an explicit module map, Vitest 5, and the Edge Runtime environment. Tests and fixtures live outside deployable Convex functions in `packages/backend/tests/`; `tests/tsconfig.json` type-checks them separately from `convex/tsconfig.json`.

Dispute fixtures seed users, a client, an assigned freelancer, an unrelated wallet, a configured administrator, a job, and a funded or submitted escrow directly. They support both micro-gig and milestone parents. Tests then create disputes through `api.disputes.createDispute` and exercise administrator paths through `api.admin` with synthetic test-only environment values. Each test receives a fresh in-memory database and deterministic clock; environment and timer stubs are restored after each test. No network calls, live credentials, or mocked authorization/dispute helpers are used.

The Deliverable 2 C02 extension adds parameterized parent/reason/wallet/status/event vocabulary checks, optional event-status fields, unknown/type/wrong-table rejection checks, `by_assignedAdmin_updatedAt` isolation and ordering, generated `api.disputes` export references, malformed public arguments with rejected-write preservation, participant present/missing/denied result shapes, and the legacy rejecting moderator-note/resolution placeholders. Working administrator APIs remain under `api.admin`.

The focused Deliverable 2 C02 run passes 59 tests across the schema, index, and API contract files. The full current backend suite passes 154 tests across 10 files. The backend source and test TypeScript projects both type-check; local tests use deterministic in-memory Convex state and do not prove Stellar RPC execution, transaction signing/submission, deployed contract identity, or chain event ingestion.

## Contract coverage to preserve

The Rust tests cover initialization/reinitialization, authorization, amount/rating validation, duplicate reputation completion, aggregate statistics, escrow lifecycle/status guards, dispute flows, asset allowlisting, and contract wiring assumptions. Read the tests before changing a contract error or status.

## C20 Soroban state regression checks

Run `cd contracts && cargo test --offline -p highrable-escrow c20_` for the six C20 tests, then `cargo test` for the full contract workspace. C20 verifies 84 rejected calls across both dispute entry states and settlement/ordinary terminal outcomes, including complete escrow and balance preservation, unchanged reputation records/statistics, and no new dispute or token-transfer events. Exact invocation-scoped mocks authorize the correct actors with valid arguments so failures exercise state guards. Current verified totals are 61 escrow and 9 reputation tests.

`pnpm contracts:build` may attempt workspace dependency downloads before executing its script. In the C20 environment those downloads encountered registry DNS failures; running the defined underlying command, `cd contracts && stellar contract build`, successfully built both WASM contracts without installing JavaScript dependencies. See [C20 evidence](../../instawards/C20-Dispute-State-Regression-Evidence.md) for exact results and local-only limits.

## Web/chain boundary cases

When changing wallet or contract code, test at least:

- external wallet signing and user rejection;
- passkey smart-account preflight and authorization-entry signing;
- simulation failure versus submission failure versus confirmation timeout;
- correct client/freelancer/admin actor for each escrow action;
- integer amount/decimal conversion and unsupported assets;
- network/passphrase/RPC/Horizon mismatch handling;
- Convex phase persistence when chain submission succeeds, fails, or times out.

## What is not automatically proven

Passing local tests does not prove deployed contract IDs are wired correctly, a relayer is funded/available, production auth TODOs are resolved, or attachment/proof privacy is complete. Use [[operations/Deployment]] and [[stellar/Mainnet Readiness and Relayers]] for those checks.

## Multiple dispute-admin checks

The backend now has a focused Vitest 5 + convex-test harness using the edge-runtime environment. Run it with pnpm --filter @repo/backend test. Current backend cases cover secret/capability separation, profile-role isolation, grant/revoke state, concurrent claims, stale assignment actors, owner participant conflicts, active settlement locking, and idempotent completion. Rust coverage includes owner-managed contract membership, actor auth failure, multi-admin settlement, unknown actors, and participant conflicts.

## C22 administrator regression coverage

C22 adds a protected-page integration suite at `apps/web/features/admin/admin-protected-pages.integration.test.tsx` using the real `AdminSessionGate`, TanStack Query, and admin HTTP client with mocked wallet infrastructure and HTTP responses. It covers pre-verification read blocking, wallet mismatch, passkey mode, page-level 401/403 cache eviction, wallet changes, disconnects, stale-response isolation, and retryable reads without writes.

`apps/web/features/admin/admin-dispute-detail-page.test.tsx` now drives the real settlement coordinator with deferred phase and signed-identity callbacks. It covers preparation through final recording, duplicate-click protection, explorer links, signing/simulation retry, verified failure retry, signed/submission/confirmation/final-recording uncertainty, pending/reconciliation failure, read-only refresh retry, and 0/1/9999/10000-bps submission boundaries. The focused administrator suite passes 135 tests; the full web suite passes 211 tests. These are mocked component/integration tests, not live Testnet end-to-end evidence.
## C21 reconciliation coverage

`packages/backend/tests/disputes/c21.reconciliation.test.ts` adds deterministic retry/reconciliation integration coverage on top of the existing C13 and C17 suites. It exercises dispute creation, marking callbacks, `escrows.updateEscrowStatus`/`milestones.updateMilestoneEscrowStatus`, administrator settlement callbacks, `syncMutations`, parent-job aggregation, transaction records, and dispute side effects. The suite covers micro-gigs, milestones, sibling isolation, all three settlement outcomes, callback conflicts/replays, settlement retry/uncertainty, and atomic rollback. Test-only helpers provide scoped admin membership and sibling milestones; no generated Convex files are edited.

The focused C21 run and full backend run both pass 99 tests. Backend source and test TypeScript projects, scoped oxlint, and oxfmt checks also pass. These tests prove local Convex bookkeeping only; they do not prove live Stellar RPC reads, transaction execution, or deployed-contract behavior.
