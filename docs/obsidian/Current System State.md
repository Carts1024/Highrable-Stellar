---
type: reference
area: system
status: current
last_updated: 2026-10-07
source_of_truth: repository
---

# Current System State

This classification is based on current source, tests, manifests, deployment artifacts, and the existing implementation inventory. “Implemented” means code and an identifiable flow exist; it does not mean audited, fully automated, or production-ready.

## Functional / Implemented

- Soroban escrow creation, open escrow creation, create-and-fund open escrow, funding, assignment, submission, approval/release, cancellation, dispute marking, owner-only settlement for existing deployments, membership-enabled admin dispute settlement in current source, asset allowlisting, and read/configuration methods exist in `contracts/escrow/src/lib.rs`.
- C20 local Soroban regression coverage is implemented: six tests exercise 84 forbidden dispute/terminal invocations from funded/submitted dispute origins and ordinary release/cancellation paths. Full records, balances, reputation, and event counts remain unchanged on rejection; the contract workspace passes 61 escrow and 9 reputation tests and both WASM contracts build. This is local evidence; deployed behavior and wider sprint acceptance remain unverified.
- Deliverable 2 C13 Soroban guard coverage is verified locally: three tests bind marking/settlement authorization to invocation arguments and exercise 12 successful settlement combinations across both dispute origins, owner/registered-admin actors, and zero/split/full shares. Identical and conflicting settlement retries plus repeat marking preserve terminal state and transfers. The full contract workspace passes 72 escrow and 9 reputation tests and both WASM contracts build. See the [C13 evidence](../instawards/Deliverable-2-C13-Dispute-State-Guards-Evidence.md); mocked authorization and local execution do not prove signatures or deployed behavior.
- Deliverable 2 C06 dispute guard coverage is verified locally: revoked-admin reauthorization, participant conflicts, registered-admin marking boundaries, `1`/`9_999` bps payouts across owner/admin and funded/submitted origins, invalid shares, and all non-disputed statuses are covered. `cargo test --workspace --locked` passes 67 escrow and 9 reputation tests. Mocked authorization does not prove wallet signatures or deployed behavior; the membership-enabled source remains undeployed as described below.
- The current escrow source emits versioned `dispute/marked` and `dispute/resolved` events after successful state writes. C07 Rust regressions compare mark-event escrow identity/status to persisted state and cover target isolation plus missing-ID rejection without side effects; `cargo test --workspace --locked` passes 69 escrow and 9 reputation tests. See the [C07 evidence](../instawards/C07-Dispute-Marking-Evidence.md). The C16 event handoff remains accurate. Resolution hashes are emitted but remain absent from persistent escrow records. Local tests do not establish deployed behavior or wallet signatures.
- Soroban reputation initialization, authorized completion recording, immutable completion lookup, existence checks, and freelancer aggregate statistics exist in `contracts/reputation/src/lib.rs`.
- The release path transfers the escrow asset to the freelancer and invokes reputation `record_completion`.
- Convex has a composed schema for users, jobs, milestones, applications, escrows, agreements, submissions, attachments, collaboration, deadlines, revisions, cancellations, disputes, reputation mirrors, transactions, reports, and waitlist entries.
- Convex dispute creation preserves C05 parent/participant authorization and now validates all related submissions, revisions, messages, deadline events, and evidence before writes; opening is canonical, deduplicated, atomic, and audited with one `dispute_opened` event while agreement context and notification/system-message side effects remain intact.
- Convex dispute evidence handling is C08-hardened: raw attachment limits are checked before first-seen deduplication, the unique typed IDs are reused for reassignment, dispute evidence, and audit attachments across creation/evidence/response mutations, and supplied participant messages are sanitized before writes. Existing attachment ownership/case rules, raw related-reference limits, public contracts, schemas, indexes, statuses, optional-link compatibility, and caller-supplied wallet boundary remain unchanged. The focused C08 suite passes 23 tests; the full backend suite passes 262 tests across 11 files.
- Convex dispute marking callbacks are C13-hardened and idempotent: accepted phase transitions preserve hashes and historical failure events, duplicate callbacks avoid repeated audit/message/notification side effects, terminal review cases cannot be reopened, and same-hash success/stale-failure replays are harmless. The frozen callback arguments, boolean returns, schema, statuses, event types, and participant/configured-admin wallet boundary remain unchanged.
- Deliverable 2 C14 marking callback coverage is verified locally: first-failure guidance distinguishes recorded-hash reconciliation from retry only when not submitted, using stored-or-incoming hashes in audit/message references. Fifty new cases cover terminal phase combinations, authorization before replay returns, repeated retries, preserved history, and late hash recovery for both parent kinds. C14/C13/C21 pass 86 tests; the full backend suite passes 312 tests in 12 files; backend/test TypeScript and scoped oxlint/oxfmt pass. Public callback contracts and guards are unchanged. This proves bookkeeping only; caller-supplied wallets and the absence of attempt IDs remain limitations, and no reconciliation service or deployment was added. See the [C14 evidence map](../instawards/Deliverable-2-C14-Marking-Evidence.md).
- Deliverable 1 C13 Convex dispute marking callbacks are hardened and idempotent: accepted phase transitions preserve hashes and historical failure events, duplicate callbacks avoid repeated audit/message/notification side effects, terminal review cases cannot be reopened, and same-hash success/stale-failure replays are harmless. The frozen callback arguments, boolean returns, schema, statuses, event types, and participant/configured-admin wallet boundary remain unchanged.
- The web app has marketplace, job, dashboard, onboarding, profile, proof, dispute, work-agreement review, admin, and wallet/passkey routes. `/talent` is intentionally not in this category; see below.
- External-wallet challenge/verify authentication creates signed HTTP-only session cookies. Admin APIs derive the actor from the verified wallet; Convex separately checks the server-only secret, owner/dispute-admin capability, scope, assignment, and participant conflicts.
- Owner-managed dispute-admin membership, assignment history, claim workflow, and signed settlement recovery are implemented in source. Platform metrics and team/assignment management remain owner-only; app dispute work is assignment-scoped.
- Deliverable 2 C11 admin evidence review is implemented: protected case evidence is rendered independently from timeline evidence, missing/unusable records fail closed, safe links use validated HTTP/HTTPS URLs, and manual detail refresh replaces evidence/status without writes or Stellar calls. Focused admin coverage passes 173 tests, full web coverage passes 286 tests, and the web build passes. This is mocked local UI/session/API evidence; live deployment and storage verification remain outside scope.
- Deliverable 2 C12 admin assignment and review controls are implemented on top of the existing endpoints and Convex-derived policy: normalized/deduplicated nonparticipant assignees, disabled historical inactive options, membership-read gating, participant/terminal claim guards, active-settlement detail reassignment locks, duplicate-submission prevention, cross-filter queue/detail cache invalidation, non-optimistic refreshes, preserved rejected drafts/conflicts, and read-only recovery after post-write refresh failure. Real session-gate coverage includes mutation 401/403 cache eviction and existing late wallet-response protection. Focused admin coverage passes 190 tests, full web coverage passes 303 tests, web TypeScript and scoped oxlint/oxfmt pass, and the production build passes. No backend policy, schema, generated file, wallet, environment, contract, deployment, transaction, audit/notification side effect, or live-chain behavior changed or was verified.
- Administrator settlement records remain C17-hardened across started, signed, submission-unknown, succeeded, and failed callbacks. The earlier C17 implementation added validation and atomic replay-safe bookkeeping. Deliverable 2 C17 regression coverage now adds 32 deterministic in-memory tests for operation identity, all active-attempt phases, same-escrow locking, signed identity, phase/state guards, authorization, participant conflicts, complete snapshots, and side-effect idempotency. Focused C17+C21 coverage passes 50 tests; the full backend suite passes 330 tests across 12 files. No production violation was demonstrated or fixed. See the [C17 settlement-attempt evidence](evidence/C17-Settlement%20Attempt%20Regression%20Evidence.md).
- External-wallet and passkey smart-account execution both route through shared escrow helpers and a wallet-specific transaction executor.
- Deadline reminder scanning is scheduled by Convex every 15 minutes.

## Implemented but Operationally Incomplete

- Convex escrow and reputation synchronization exists, but it is action-driven (`syncEscrowStatus`, `syncReputationRecord`) and manually triggered from product flows. It is not a general chain indexer or fully scheduled mirror.
- `transactions` stores application transaction records, but historical wallet transaction indexing is explicitly post-MVP and absent from the repository.
- Passkey smart-account execution includes compatibility fallbacks and runtime WASM/signer checks. The current implementation is sensitive to the configured smart-account artifact and `smart-account-kit` behavior.
- XLM-to-USDC path-payment top-up exists for classic external wallets, but requires a USDC trustline, sufficient spendable XLM, and available path liquidity. XLM escrow is optional and requires a configured native XLM token contract.
- Mainnet readiness checks are extensive, but they do not constitute contract, relayer, backend, monitoring, or operational audits.
- The membership-enabled escrow source, C16 dispute event emission, and frontend/backend workflow have not been deployed. Existing deployments retain owner-only settlement, do not enforce the new participant-conflict rule, and do not emit C16 events. Activation requires a fresh isolated contract/deployment database; existing ID lookup/synchronization is unsafe across overlapping escrow-ID spaces.
- Proof and agreement records carry hashes and protection metadata, but source-file and attachment content checksum TODOs remain in backend/client paths.
- Settlement payout bookkeeping still truncates whole units before calculating the client refund. Token-precision arithmetic is deliberately deferred to a separate follow-up; C17 does not change payment amounts.

## Experimental or Compatibility-Sensitive

- Passkey smart accounts are Soroban contract accounts (`C...`), not ordinary classic wallets. Execution depends on `smart-account-kit@0.2.10`, `smart-account-kit-bindings@0.1.2`, WebAuthn context rules, a compatible account WASM hash, and a fee path.
- The passkey executor contains compatibility logic for legacy context-rule shapes and custom AuthPayload signing. Treat changes in this area as protocol-sensitive.
- Smart-account relayer support recognizes `none`, `custom`, `openzeppelin_channels`, and `sdk_source_account`; legacy Launchtube is explicitly unsupported.

## Placeholder

- `/talent` renders a planned discovery surface with preview cards and explicitly says live talent search is not available.
- `deployments/smart-accounts/testnet.json` and `deployments/smart-accounts/mainnet.json` contain placeholder metadata with empty artifact, verifier, factory, relayer, and verification fields.
- A dedicated historical chain transaction indexer and contract-event-driven indexing layer do not exist.

## Planned / Not Implemented

- Historical wallet transaction synchronization/indexing (`syncWalletTransactions` is marked post-MVP).
- Reputation-contract event emission; the contract-event indexer and backend event ingestion remain absent.
- Strong signed-session enforcement across every public Convex mutation.
- Complete file-content hashing for agreement source uploads and work-submission attachments.
- A production-hardened, audited relayer and broader production operations around passkey fee sponsorship.
- A live talent directory/search experience.

## Known Technical Debt

- Several public Convex mutations explicitly document that they still trust a caller-supplied wallet address and should move to signed-session/auth enforcement.
- Dispute C09 validates caller-supplied wallet values against Convex participant records but does not prove wallet possession; signed-session enforcement remains future work.
- Source and docs disagree on runtime/tooling prerequisites: root `package.json` declares Node `>=20.9.0` and pnpm `12.5.1`, while `GEMINI.md` says Node 18+/pnpm 8.6+ and `README.md` says pnpm 11.1.2. Use the root manifest.
- The older implementation inventory does not list `resolve_dispute`, although the current escrow contract implements and tests it. This vault follows the Rust source.
- `docs/deployments.md` links to missing `docs/passkey-smart-accounts.md`; the existing `docs/passkey-smart-account-implementation.md` is the useful guide.
- Existing phase/roadmap documents can describe completed work as future work. Verify before using them as requirements.
