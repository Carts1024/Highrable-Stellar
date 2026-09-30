---
type: changelog
area: changelog
status: current
last_updated: 2026-09-30
source_of_truth: repository
---

# Knowledge Changelog

## 2026-09-30

- Completed C13 idempotent dispute chain-phase hardening. `markDisputeOnChainStarted`, `Succeeded`, and `Failed` now guard legal transitions, preserve the first known transaction hash and failure history, clear only the current mark error on accepted retry/success, and suppress duplicate events, messages, notifications, and timestamp writes. Frozen arguments, boolean returns, schema values, event types, authorization boundary, and parent/transaction orchestration remain unchanged.
- Added 18 deterministic Convex tests for micro-gigs and milestones covering success/failure/retry paths, duplicate callbacks, late/stale/conflicting hashes, known-hash reconciliation guards, blank/missing inputs, terminal review states, client/freelancer/configured-admin/unrelated-wallet authorization, both wallet types, and rejected-record preservation. The focused C13 suite passes 18/18; the full backend run passes 64 tests and retains three pre-existing admin assignment/configuration failures outside C13.

## 2026-09-29

- Completed C09 dispute creation hardening: typed and deduplicated related-record validation now covers submissions, revisions and their referenced submissions, messages/conversations, exact deadline parents, and active caller-owned evidence before agreement-version or dispute writes. Opening remains atomic with canonical participants, one deduplicated `dispute_opened` audit event, agreement context, notification, and best-effort system messages. Added deterministic coverage for aliases, legacy links, shared job conversations, previous disputes, invalid/conflicting references, count boundaries, evidence reassignment, and rollback; backend tests pass 49/49.
- Added C12 escrow settlement invariants for full refund, full payout, and rounded split from both funded and submitted dispute states, including full-record and balance-conservation assertions.
- Completed C10 admin review-control hardening: loaded status initialization (`open` maps to `under_review`), validated three-target selection, centralized assigned-admin/nonparticipant/nonterminal UI eligibility, pending duplicate protection, associated review-message labeling, queue-cache invalidation across filters, detail/timeline refresh, rejected-write draft preservation, and read-only retry after successful-write refresh. Focused admin Vitest coverage passes 37 tests; review controls do not invoke Stellar execution.
- Documented owner-managed dispute-admin membership, scoped capabilities, claim/assignment rules, signed settlement recovery, and the fresh isolated deployment requirement. The new contract behavior remains undeployed.
- Added the backend convex-test/Vitest harness and recorded focused contract/backend coverage and test commands.
- Strengthened C08 `resolve_dispute` tests with exact invocation-scoped authorization, share/status boundaries, repeat-settlement checks, and full escrow/token-balance preservation assertions; documented mocked-auth limits and owner/registered-admin participant-conflict rules.

## 2026-09-28

- Documented the Stellar Wallets Kit JSR/npm alias pair and the narrow pnpm hoist needed by MetaMask Connect Stellar's published import.
- Hardened `/admin/disputes` and `/admin/disputes/[disputeId]` with server-verified configured-wallet access, identity-scoped TanStack Query reads, explicit auth/loading/error/not-found states, and no-store `/api/admin/session` responses.
- Completed C06 frontend handoff: Convex-derived shared dispute types, exhaustive status labels and terminal classification, typed admin filters/network errors, loading/error/retry regression coverage, and the frozen participant/admin ownership contract in `docs/instawards/C06-Frontend-Handoff.md`.
- Added the C02 backend dispute regression harness with `convex-test`, deterministic fixtures, explicit Convex module loading, separate test TypeScript configuration, and verified schema/index/participant/admin/failure-path coverage without changing production dispute contracts.
- Hardened C05 dispute creation authorization: typed parent-ID normalization, job/milestone/escrow relationship invariants, explicit escrow and `job` alias handling, legacy micro-gig compatibility, assigned `funded`/`submitted` eligibility, normalized participant roles, and status-index duplicate detection without a 50-record blind spot. Extended the in-memory suite to 40 passing backend tests and documented the unchanged admin credential boundary and wallet-possession limitation.
- Added reusable timestamped escrow fixtures and stronger dispute lifecycle regression checks. Tests compare complete records and token balances around successful and rejected dispute marking; mocked authorization remains a lifecycle-testing boundary (see [[contracts/Escrow Contract]]).
- Added C04 dispute authorization coverage using exact invocation-scoped mock auth after broad fixture setup, including absent/mismatched host authorization and role/status boundaries. This verifies Soroban host authorization behavior, not cryptographic signatures or wallet integration (see [[contracts/Escrow Contract]]).

## 2026-09-27

- Updated the Velo Gas Station integration to SDK `0.1.0-alpha.4`, including the `tg_test_` Gas key requirement, corrected Testnet origin default, preferred `VELO_GAS_BASE_URL` configuration, and server-side key-shape validation.

## 2026-09-26

- Documented the opt-in Velo Gas Station Testnet boundary: pinned SDK, authenticated server handoff, Convex recovery identity, safe response fields, status-only recovery, and operator prerequisites.
- Documented landing-page responsive behavior: fluid root scale on large displays, `V2SnapGuard`-driven snap relaxation for oversized sections, and reduced reveal travel on phones (see [[frontend/Frontend Overview]]).

## 2026-09-21

- Initialized the repository-native Obsidian vault at `docs/obsidian/`.
- Added linked navigation, current-state classification, architecture, modules, data/state machines, contract notes, frontend/backend notes, Stellar/wallet notes, operations runbooks, workflows, and ADR index.
- Added root `AGENTS.md` with vault-reading and source-authority guidance.
- Added minimal `.obsidian/app.json` and narrowly scoped ignores for local workspace/cache state.
- Recorded known contradictions and gaps instead of presenting roadmap or phase prose as current behavior.

## Maintenance rule

Add an entry when documentation structure or a durable system-status classification changes. Feature-level implementation history belongs in version control and the relevant source/module note; this file should stay short.
