---
type: runbook
area: operations
status: current
last_updated: 2026-10-01
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

The C02 backend harness uses `convex-test` with the real composed schema from `packages/backend/convex/schema.ts`, an explicit module map, Vitest 2, and the Edge Runtime environment. Tests and fixtures live outside deployable Convex functions in `packages/backend/tests/`; `tests/tsconfig.json` type-checks them separately from `convex/tsconfig.json`.

Dispute fixtures seed users, a client, an assigned freelancer, an unrelated wallet, a configured administrator, a job, and a funded or submitted escrow directly. They support both micro-gig and milestone parents. Tests then create disputes through `api.disputes.createDispute` and exercise administrator paths through `api.admin` with synthetic test-only environment values. Each test receives a fresh in-memory database and deterministic clock; environment and timer stubs are restored after each test. No network calls, live credentials, or mocked authorization/dispute helpers are used.

Verified C02 coverage includes schema enum/type/ID rejection contracts, every existing dispute/event index and field order, participant opening and persisted opening events, administrator review/moderator-note events, participant filtering, parent/escrow/status lookup, chronological timelines, duplicate active disputes, unrelated participants, and invalid administrator credentials.

## Contract coverage to preserve

The Rust tests cover initialization/reinitialization, authorization, amount/rating validation, duplicate reputation completion, aggregate statistics, escrow lifecycle/status guards, dispute flows, asset allowlisting, and contract wiring assumptions. Read the tests before changing a contract error or status.

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
