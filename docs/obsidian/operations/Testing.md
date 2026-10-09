---
type: runbook
area: operations
status: current
last_updated: 2026-10-09
source_of_truth: repository
---

# Testing

## Test layers

The Deliverable 2 C19–C24 final local run passes 346 web tests, 361 backend tests, and 49 deployment-verifier tests. Administrator and participant acceptance use real components with controlled external seams, paired with separate actual backend/domain tests. See [the C24 final evidence map](../../instawards/Deliverable-2-C24-Participant-Acceptance-Evidence.md). Production contract build provenance and live deployment identity are still unavailable.

Deliverable 2 C22 extends participant integration coverage for revoked access during writes, stale wallet/case results, independent accessible form recovery, and saved-hash refresh without resubmission. The participant and attachment suites pass 60 tests across 10 files at this checkpoint; see [C22 evidence](../../instawards/Deliverable-2-C22-Participant-Integration-Evidence.md). This is local mocked transport/component evidence.

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

At the Deliverable 2 C02 checkpoint, the focused schema/index/API contract run passed 59 tests and the backend suite passed 154 tests across 10 files. The backend source and test TypeScript projects both type-check; local tests use deterministic in-memory Convex state and do not prove Stellar RPC execution, transaction signing/submission, deployed contract identity, or chain event ingestion.

## Deliverable 2 C05 authorization and creation matrix

`packages/backend/tests/disputes/c05.authorization.test.ts` uses the real composed schema, deterministic fixtures, and public Convex functions. The focused run passes 111 tests. It covers all supported participant/status/entry-path combinations, legacy jobs without `jobType`, canonical parent and participant derivation, one opening audit event, configured nonparticipant administrators, profile-role isolation, unassigned/non-eligible escrows, malformed/missing/wrong-table/conflicting parent graphs, explicit escrow ambiguity resolution, active duplicate statuses and aliases, independent milestone conflicts, and terminal/long-history behavior.

C05 rejection cases seed valid evidence and an accepted agreement, then compare complete document snapshots before and after failure across disputes, attachments, dispute events, notifications, conversations/messages, agreement records/versions/events, and linked job/milestone/escrow records. The full backend suite passes 239 tests across 10 files; backend source/tests type-check, scoped oxlint passes, and the changed test file passes oxfmt. No production, schema, generated, frontend, contract, migration, or deployment changes were needed. This is local in-memory Convex evidence only, not live-chain or signed-session verification.

## Deliverable 2 C10 participant timeline regression coverage

`apps/web/features/disputes/components/dispute-timeline.test.tsx` derives typed fixtures from the generated Convex return type and covers every timeline event type and actor role, optional status fields, attachments, transaction links, loading/empty states, keyed wallet/dispute replacement, and repeated retryable failures. `dispute-participant-integration.test.tsx` uses the real participant detail, action, and timeline components to preserve drafts across timeline failure, prove retry is free of mutations and Stellar operations, and verify permission revocation/disconnect cleanup plus current-wallet/current-case restoration.

The exact focused command `pnpm --filter web test features/disputes` passes 54 tests across 9 files. `pnpm --filter web exec tsc --noEmit`, scoped oxlint, and scoped oxfmt checks pass. These are mocked local UI checks only; list, route, and status-label acceptance remains covered by the existing C04 tests, and no live Convex, wallet-possession, Stellar, deployment, or contract behavior is proven. See `docs/instawards/Deliverable-2-C10-Participant-Timeline-Evidence.md` for the acceptance map and commands.

## Deliverable 2 C11 administrator evidence review

The administrator detail suite covers independent case/event evidence, metadata, empty and missing references, null/unsafe/deleted/blocked attachments, safe descriptive links, refresh replacement, 404/403 removal, retryable failures, and no-write/no-Stellar refresh behavior. The real protected-page integration suite covers assigned-admin rendering through `AdminSessionGate`, wallet changes, disconnects, and late detail responses.

`pnpm --filter web test features/admin` passes 173 tests across 7 files, and `pnpm --filter web test` passes 286 tests across 23 files. Web TypeScript, scoped oxlint/oxfmt, and `pnpm --filter web build` pass. These are mocked local UI/session/API checks only; live Convex, storage URL availability, Stellar, deployment, and transaction execution are not proven. See `docs/instawards/Deliverable-2-C11-Admin-Evidence-Review-Evidence.md`.

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
