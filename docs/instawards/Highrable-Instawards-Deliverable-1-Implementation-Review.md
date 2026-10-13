---
title: Highrable Instawards Deliverable 1 — Implementation Review
type: delivery-review
status: reviewed
baseline_commit: 0d443f36c982c6373a97e8e57b0676e05d25d435
reviewed_through: 8eb4514f5378aab3c3af889d0fc00d32cdfa60be
reviewed_on: 2026-10-02
source_of_truth: repository
---

# Highrable Instawards Deliverable 1 — Implementation Review

## Purpose and naming

This review uses “Deliverable 1” to mean the three-day Week 1 foundation in the [sprint plan](./Highrable-Instawards-Deliverable-1-Sprint-Plan.md). It is not the SOW’s role-specific “Deliverable 1: Soroban Dispute Contract Feature.” The Week 1 work advances all six SOW workstreams.

The baseline tree is commit **0d443f36c982c6373a97e8e57b0676e05d25d435**. The reviewed tree is **8eb4514f5378aab3c3af889d0fc00d32cdfa60be** (8eb4514, merged PR #85). The baseline commit is included as context; the code comparison is from that tree to the reviewed tree.

Git reachability reports **88 commits after the baseline**: 32 non-merge commits and 56 merge/synchronization commits. Counting the baseline commit itself, the inclusive history slice contains **89 commits**: 33 non-merge commits and 56 merges. The earlier SOW snapshot ended at 38bf72e and covered 77 descendants (28 non-merge, 49 merge); 11 commits (4 non-merge and 7 merge) were added after that snapshot. Some reachable side-branch commits have dates before the baseline commit; the counts describe Git history topology, not elapsed sprint time or 88 independent feature tasks.

The starting commit itself adds reusable escrow test fixtures and dispute lifecycle assertions. The final state and the before/after comparison below use the baseline tree and current source, so intermediate reverts and branch merges are not mistaken for final behavior.

## Executive summary

Highrable already had a dispute path before this deliverable: Soroban could mark an eligible escrow disputed and let the configured platform administrator settle it; Convex stored dispute cases and timeline events; participants could open cases and submit evidence; an owner-facing web admin console could review them.

This deliverable hardens that foundation across the contract, Convex, and web layers. It adds scoped dispute-admin membership and case assignment, validates dispute parent and evidence relationships, makes marking and settlement bookkeeping recoverable, emits versioned Soroban dispute events, and gives both participants and administrators clearer protected workflows and failure states. It also establishes dedicated backend and frontend regression suites and expands Soroban lifecycle coverage.

The result is a substantially more reviewable dispute implementation in source. It is not evidence that the complete SOW acceptance scope has shipped: current source still needs verified deployment alignment, end-to-end Testnet lifecycles, a consolidated test report, reviewer deployment, and the remaining evidence package.

## Highrable before and after

| Area | At baseline commit 0d443f3 | At reviewed head 8eb4514 |
| --- | --- | --- |
| Marketplace and escrow | Highrable already had Stellar escrow contracts, Convex escrow/job/milestone records, participant dispute routes, and a configured-admin console. | Those product boundaries remain; the dispute workflow now has stricter cross-layer contracts and stronger recovery evidence. |
| Soroban dispute authority | mark_disputed already accepted the client, assigned freelancer, or platform admin for funded/submitted escrow. resolve_dispute already split escrow funds by basis points and was restricted to the configured platform admin. | The platform owner can add/remove dispute admins; the owner and registered admins can resolve a disputed escrow, except when the resolver is one of that escrow’s participants. Successful marking and resolution emit version 1 Soroban events. |
| Convex workflow | disputes and disputeEvents already recorded participants, related work, evidence IDs, review statuses, on-chain marking phases, and transaction references. Creation and marking existed, with less exhaustive related-record and callback guards. | Parent, escrow, participant, attachment, submission, revision, conversation/message, and deadline relationships are checked before writes. Marking callbacks are phase-guarded and replay-safe. Membership, assignment, and settlement-attempt records support controlled administration and recovery. |
| Participant experience | Participants already had list/detail routes, an opening dialog, evidence upload, responses, and a timeline. | Route states, eligibility and related-record validation, explicit evidence/response actions, timeline errors, accessible forms, and saved-case behavior distinguish application errors from chain failures and uncertain transactions. |
| Administrator experience | The configured administrator could enter an owner-oriented dispute console and use existing admin APIs. | Signed-session and wallet matching gate protected data; dispute admins can claim eligible cases; the owner manages membership and assignment; assigned admins review and initiate settlement. Settlement phases preserve signed transaction identity and provide reconciliation without blind resubmission. |
| Automated validation | Rust escrow tests existed. The baseline did not contain the dedicated Convex Vitest harness or the current dispute-focused web regression suite. | Rust coverage includes authorization, settlement conservation, events, rollback, and terminal-state guards. Convex and web have dedicated Vitest suites and committed test evidence. |
| Deployment evidence | The canonical deployments/testnet.json represented the earlier escrow/reputation deployment. | A separate deployments/testnet-multi-admin.json records a Testnet contract ID and a September 29 timestamp in the multi-admin workstream. That timestamp is 09:41 +08, before commit c6cc7e1 at 10:03 +08, which adds dispute-admin membership. The artifact has no code hash or deployment link, so it does not verify that membership build; C16 event source was added later still. A matching, verified deployment remains an acceptance task. |

The baseline already included meaningful dispute functionality. The central contribution is **workflow hardening and completion of missing integration foundations around that existing feature**.

## What the implementation adds

### 1. Soroban escrow contract

The authoritative contract changes are in [contracts/escrow/src/lib.rs](../../contracts/escrow/src/lib.rs); its regression suite is in [contracts/escrow/src/test.rs](../../contracts/escrow/src/test.rs).

- **Owner-managed dispute-admin membership.** The platform owner can add or remove an address and query membership. The owner remains a dispute admin without a separate membership record. Membership is stored in the contract instance.
- **Separated marking and resolution roles.** Marking continues to require an authenticated client, assigned freelancer, or platform owner and accepts only Funded or Submitted escrows. Resolution requires an authenticated owner or registered dispute admin, requires the escrow to be Disputed, and rejects either escrow participant as resolver.
- **Settlement arithmetic remains explicit.** Freelancer share is bounded to 0–10,000 basis points. The freelancer amount uses integer division; the client receives the remainder, so both transfers sum to the escrow amount. A zero freelancer share produces Cancelled; any positive share produces Released.
- **Versioned event envelope.** Successful marking emits dispute/marked with version, actor, and resulting status. Successful settlement emits dispute/resolved with version, actor, resulting status, supplied resolution hash, asset, parties, share, and actual transfer amounts. Events are emitted after the state write and settlement transfers. The resolution hash is emitted but not persisted in the escrow record.
- **Broader contract regression coverage.** Tests assert invocation-scoped authorization, exact event topics and payloads, amount conservation, rollback when a transfer fails, and rejection of invalid or terminal-state re-entry. The C20 evidence covers 84 rejected invocations across 6 new regression tests.

The Soroban event interface is documented in the [C16 event handoff](./C16-Dispute-Event-Handoff.md). These contract events do not feed the Convex timeline: there is no event indexer or ingestion path in this deliverable.

### 2. Convex dispute and administrator workflows

The core implementation is in [packages/backend/convex/disputes](../../packages/backend/convex/disputes/) and [packages/backend/convex/admin](../../packages/backend/convex/admin/). The root schema composes the added admin tables through [packages/backend/convex/schema.ts](../../packages/backend/convex/schema.ts).

- **Dispute creation validates the whole case context.** The backend resolves the escrow, job or milestone, and canonical client/freelancer identities. It checks eligibility and active duplicates, normalizes IDs for their expected tables, and validates each related submission, revision request, message/conversation, deadline event, and attachment against that same work item and its participants before recording the case. Opening, evidence ownership, audit event, notification, and related writes are handled through the mutation path.
- **Marking callbacks are idempotent.** Start, success, and failure callbacks validate the actor and status before changing state. Duplicate starts and matching success/failure replays avoid duplicate events, messages, notifications, and timestamps. A failed mark without a known transaction hash can be retried; a hash-recorded or conflicting attempt is held for reconciliation.
- **Admin membership is scoped.** Convex membership is tied to the configured Stellar network and escrow contract. Protected admin mutations check the server secret, active membership or configured owner, and participant conflicts.
- **Case ownership is recorded.** Active dispute admins can claim eligible unassigned cases. The owner can assign or reassign cases and manage membership. Assignment history is recorded. Assigned-admin checks gate review notes, status changes, and settlement starts.
- **Settlement attempts persist transaction identity and phases.** Backend records operation ID, acting wallet, resolution share, signed hash and expiry, and phases including started, signed, submission_unknown, succeeded, and failed. A single active operation is enforced per escrow. Matching callbacks are replay-safe; a known signed transaction is reconciled before the backend finalizes dispute, escrow, milestone/job, transaction, audit, message, and notification state.
- **Parent records are reconciled without rewriting Soroban authority.** Convex mirrors successful escrow outcomes into linked application records. Soroban remains authoritative for on-chain escrow status and funds. The C21 suite checks micro-gigs, milestones, sibling isolation, callback replay, sync boundaries, and rollback on missing related records.

The database state machines and accepted limitations are described in [Disputes and Cancellations](../obsidian/modules/Disputes%20and%20Cancellations.md) and [Admin Operations](../obsidian/modules/Admin%20Operations.md).

### 3. Participant interface

Participant route and feature changes are in [apps/web/app/disputes](../../apps/web/app/disputes/) and [apps/web/features/disputes](../../apps/web/features/disputes/).

- List/detail reads are wallet-scoped; detail routes have explicit loading, forbidden, missing, and failed-read states.
- The opening form checks backend eligibility, asks for a title and reason, validates the description and attachment state, and lets the participant choose related submissions and revision requests. The backend repeats all authorization and relationship validation.
- The UI preserves the created dispute ID if on-chain marking fails. The participant can open the saved case and see the chain state instead of accidentally creating a duplicate.
- Separate evidence and response composers submit only for an eligible participant on an active case. Attachment access remains behind backend checks for ownership and case association.
- The timeline renders actor and status changes from Convex events. Timeline read failures can be retried independently from the case detail.
- Marking states distinguish pre-submission failure, a known transaction hash, uncertain submission/confirmation, confirmed chain state, and failure to record a confirmed result in Convex. Retry is disabled for a possibly submitted or hash-recorded transaction until reconciliation; a safe new attempt uses a new operation ID.
- C24 adds integrated form, action-gate, timeline, attachment-label, and keyboard-accessibility coverage.

The shared participant/admin dispute types and frozen frontend handoff are recorded in [C06-Frontend-Handoff.md](./C06-Frontend-Handoff.md). Participant wallet values are still supplied to Convex by the caller; the backend checks them against case records but does not prove wallet possession through the admin-style signed session.

### 4. Administrator interface and server boundary

Admin pages and server routes are in [apps/web/features/admin](../../apps/web/features/admin/), [apps/web/core/admin](../../apps/web/core/admin/), and [apps/web/app/api/admin](../../apps/web/app/api/admin/).

- Protected queue and detail content waits for the signed admin session to match the currently connected external wallet. Wallet changes, disconnects, forbidden responses, and authentication failures clear protected data. Passkey mode does not mount the administrator console.
- Owner-facing tools expose dispute-admin membership and operation recovery. Dispute reviewers are routed to the dispute console. The queue supports filters and assignment/claim actions; assigned administrators get review controls and settlement actions for their cases.
- Server routes keep browser calls separate from Convex admin mutations. They validate session context, request shape, configured scope, and server-side secret handling.
- Settlement validates the resolution choice and basis-point share, simulates before submission, records the signed transaction identity, and tracks preparation, signing, submission, confirmation, and final recording. If submission or confirmation is uncertain, recovery checks the saved transaction context and chain state instead of submitting a second operation. A verified failed transaction may be retried as a new operation.
- Chain verification reads the configured escrow contract and the referenced escrow. Convex finalization is tied to the signed transaction identity and expected on-chain state.

Application assignment is stricter than the Soroban contract: Soroban checks active contract membership and participant conflict, but does not know Convex case assignment. Directly authenticated calls by another active on-chain dispute admin can therefore settle outside the app assignment rule. Assignment is an application authorization boundary, not an on-chain one.

### 5. Regression and build support

The change adds a backend Vitest configuration and fixtures under [packages/backend/tests](../../packages/backend/tests/) and dispute-focused frontend Vitest coverage under [apps/web](../../apps/web/). It also updates workspace dependencies and generated Convex declarations needed by those packages.

The committed evidence records the following successful local runs:

| Evidence note | Reported result | What it demonstrates |
| --- | --- | --- |
| [C20 escrow regression evidence](./C20-Dispute-State-Regression-Evidence.md) | 61 escrow tests and 9 reputation tests passed; 6 C20 tests cover 84 rejected calls. Direct stellar contract build succeeded. | Native contract behavior and build output. No deployment was performed as part of this evidence run. |
| [C21 backend reconciliation evidence](./C21-Dispute-Reconciliation-Evidence.md) | 99 backend tests across 8 files passed; focused TypeScript, lint, and formatting checks passed. | In-memory Convex lifecycle, idempotency, and reconciliation behavior. It does not execute Stellar RPC. |
| [C22 administrator regression evidence](../obsidian/evidence/C22-Administrator%20Regression%20Evidence.md) | 135 focused admin tests and 211 full web tests across 17 files passed; web build and TypeScript checks passed. | Mocked protected-page and settlement coordinator behavior, not live chain transactions. |
| [C24 participant verification](./C24-Participant-Frontend-Verification.md) | The note reports 204 web tests across 20 files, with TypeScript, route type generation, and focused lint passing. | Participant integration and accessibility checks at that verification snapshot. |

C22 and C24 record different web-suite totals and file counts from different verification snapshots. They are not additive and do not establish a single consolidated run at the reviewed head. This documentation review did not rerun tests. The C20 note also records that the package-level pnpm contracts:build attempt was interrupted by registry DNS failure, while the underlying stellar contract build command succeeded.

## End-to-end flow after this deliverable

1. A client or freelancer requests eligibility and opens a dispute. Convex resolves the work parent, validates the participants and related evidence, saves the case, and records its opening event.
2. The participant signs a Soroban mark_disputed transaction. Convex stores each marking phase and transaction reference; participant views show confirmed, retryable, or uncertain state.
3. An authorized dispute administrator claims the case or receives an owner assignment. The admin app verifies the signed wallet session and loads only protected admin data.
4. The assigned administrator reviews the case and chooses client refund, freelancer payout, or split share. The frontend simulates and signs once, then records the signed transaction identity before waiting for settlement.
5. If the chain result is uncertain, recovery checks the existing hash and contract state. After verified success, Convex finalizes application records idempotently and keeps the chain as the authority for escrow state.

## Impact across the full SOW sprint

| SOW workstream | Deliverable 1 contribution | Status at reviewed head and impact on Weeks 2–4 |
| --- | --- | --- |
| **1. Soroban dispute contract** | Adds dispute-admin membership, resolver/participant conflict checks, versioned mark/resolve events, and deeper authorization, conservation, rollback, and terminal-state tests. | Contract source is substantially advanced. The separate multi-admin artifact is dated September 29 at 09:41 +08, before the 10:03 +08 membership commit and the September 30 event addition. It has no code hash or deployment link and does not verify that either source change is deployed. Verify the deployed bytecode and deploy the event-enabled build before claiming the complete contract deliverable. |
| **2. Convex backend** | Hardens parent/evidence validation and marking callbacks; adds scoped admin membership, assignment history, persisted settlement attempts, signed-transaction recovery, and reconciliation coverage. | Workflow behavior is implemented and locally tested. Weeks 2–4 still need a reviewer environment with matching network/contract scope and verified live RPC reconciliation. |
| **3. Participant interface** | Extends existing routes with eligibility-first creation, explicit related-record selection, evidence/responses, timeline state, accessible forms, and recoverable marking failures. | The participant path is more understandable and testable. Complete it against the deployed contract and reviewer environment, including live transaction references and end-to-end evidence. |
| **4. Administrator interface** | Extends the existing owner console with signed-wallet capability checks, dispute-admin routing, membership/assignment workflows, protected queue/detail, settlement phases, and controlled recovery. | The operator path exists in source. Validate it against the intended deployed contract and database; contract membership does not enforce Convex case assignment. |
| **5. Automated testing and Testnet validation** | Adds Rust, Convex, participant, and administrator regression coverage. Evidence notes report 61 escrow and 9 reputation tests, 99 backend tests, and separate web-suite snapshots of 211 tests in 17 files (C22) and 204 tests in 20 files (C24). | Local regression evidence is available, but the web snapshots are from different verification points and are not additive. A consolidated current report, all required categories, five complete Testnet lifecycles, and matching on-chain/application records remain outstanding. |
| **6. Reviewer evidence package** | Adds the C06 frontend contract handoff, C16 event handoff, and C20/C21/C22/C24 regression and reconciliation evidence notes. | Useful technical evidence exists. The full package still needs verified deployment/code identity, explorer transaction links, reviewer deployment, consolidated reports, screenshots, and demo video. The reviewed refs use developer-named branches plus instawards/week1 and instawards/frontend; the plan’s instawards/dispute-contract, instawards/dispute-backend, instawards/dispute-admin-ui, and instawards/dispute-participant-ui refs are absent from this branch snapshot. |

This foundation reduces integration uncertainty for the remaining sprint by making the application state, contract state, administrator identity, and transaction recovery rules explicit. It does not change the SOW’s 30-day acceptance targets or prove completion of the Dispute Management Module.

## Remaining boundaries and acceptance work

- **Deployment identity:** deployments/testnet.json remains the canonical earlier deployment. deployments/testnet-multi-admin.json records a distinct Testnet contract ID and September 29 timestamp at 09:41 +08, before commit c6cc7e1 added dispute-admin membership at 10:03 +08. It contains no WASM hash, deployment transaction, or verification output, so it does not establish that the membership-enabled source was deployed. C16 events were added on September 30 and also lack a matching deployment record.
- **No event ingestion:** Soroban dispute events are emitted by the contract source but are not consumed by an indexer or Convex sync path. Convex disputeEvents remains a separate application timeline.
- **Participant possession proof:** participant Convex operations compare caller-provided wallet values with stored case relationships but do not prove the caller controls that wallet with a signed-session mechanism.
- **Assignment is not a contract rule:** Convex requires assignment for app admin review and settlement operations. Soroban only checks active dispute-admin membership and participant conflict.
- **No Testnet lifecycle evidence in these notes:** local Rust and in-memory Convex tests do not replace five complete live Testnet cycles, transaction links, or reviewer environment verification.
- **Reputation:** ordinary escrow approval records completion reputation; dispute settlement currently transfers funds and sets an escrow terminal status without recording a reputation completion.
- **PR and branch accounting:** the history contains branch/PR merges, but the reviewed branch uses developer-named branches plus instawards/week1 and instawards/frontend. The repository does not provide a complete reconciliation proving four role-specific PRs and every planned C01–C24 commit map exactly to the sprint plan’s proposed branch names.

## Commit review ledger

The 32 non-merge commits after the baseline are listed below. The 56 merge commits in the range are PR integrations or branch synchronizations; their behavior is represented by the constituent changes in the ledger and by the baseline-to-head source comparison. The baseline commit is listed separately because its resulting tree is the before-state for this report.

| Commit | Review summary |
| --- | --- |
| **0d443f3** (baseline) | Adds reusable escrow fixtures and expands dispute lifecycle tests; establishes the baseline tree. |
| **24c9cbb**, **71118ff** | Earlier branch commits add dispute-marking assertions and granular authorization tests. |
| **132060f** | Reverts an earlier Carl branch merge; intermediate branch history is not treated as final behavior. |
| **b73c202**, **1be2fa2**, **fda5497**, **03690bd** | Expand contract authorization, resolution, amount-conservation, rollback, and terminal-state coverage. |
| **506b533**, **60a9e22**, **5234c01**, **2de8773** | Add the backend test harness and harden participant authorization, parent/related-record checks, and reconciliation regression coverage. |
| **760f81d**, **76ba8fb**, **13dbc2b**, **2af7d38**, **5b284e0**, **bf707c9**, **f514833**, **9d38d6d** | Harden admin route/session contracts and review controls; add wallet mismatch handling, dispute-admin routing, settlement execution/recovery, and administrator regression coverage. |
| **27bdc7f**, **bd27b7c** | Adjust Stellar Wallets Kit dependency resolution for compatibility and remove the Google Fonts build-time network dependency. |
| **c6cc7e1**, **b52dc59** | Add dispute-admin membership/case assignment and a separate Testnet multi-admin deployment artifact. |
| **d18bea6**, **bea0955**, **d90672d**, **dc1d340**, **2e2656e**, **98c9b53** | Add participant route states, creation validation, timeline rendering, evidence/response actions, transaction recovery states, and integration/accessibility verification. |
| **9069a08**, **56c70ad**, **91439ef** | Add versioned Soroban events, idempotent marking callbacks, and settlement-attempt recovery logic. |

### Merge and synchronization commit IDs

The 12 upstream/main PR merges are **7e926cd**, **d5394e1**, **0d70c38**, **2b3c3b4**, **5cac17a**, **9f1a20a**, **3285be6**, **335b60e**, **0f36149**, **d1e0d1f**, **78e60f9**, and **8aba369**.

The 44 role-branch, Week 1, and frontend PR/synchronization merges are **10eff1d**, **a77b32c**, **e2bd3fc**, **6baf6e2**, **7b04d7f**, **cc61245**, **f099a11**, **52e2a57**, **babaa95**, **fd5f653**, **8d3d079**, **6cced85**, **f06dbbd**, **7d7a5a3**, **317df5c**, **0dab96d**, **9db1498**, **e5ca223**, **e39814a**, **ec7e388**, **b4ef95d**, **ae57ba1**, **7974bdb**, **7cb63df**, **ba3b390**, **5061309**, **74fcb53**, **a3404e2**, **40cb17f**, **74afbed**, **1b8cbec**, **2805d04**, **8cb20a9**, **d194093**, **a14216e**, **1177619**, **74d6d21**, **f0c0eba**, **71b9745**, **d6b3978**, **38bf72e**, **a473283**, **2c8a498**, and **8eb4514**.

Commit titles provide a navigation aid, not the acceptance record. The source files, tests, deployment artifacts, and evidence notes linked above determine what the reviewed tree actually implements.

## Primary references

- [Week 1 sprint plan](./Highrable-Instawards-Deliverable-1-Sprint-Plan.md)
- [Statement of Work](./Highrable-Instawards-SOW.md)
- [C06 frontend handoff](./C06-Frontend-Handoff.md)
- [C16 dispute event handoff](./C16-Dispute-Event-Handoff.md)
- [C20 Soroban regression evidence](./C20-Dispute-State-Regression-Evidence.md)
- [C21 backend reconciliation evidence](./C21-Dispute-Reconciliation-Evidence.md)
- [C22 administrator regression evidence](../obsidian/evidence/C22-Administrator%20Regression%20Evidence.md)
- [C24 participant frontend verification](./C24-Participant-Frontend-Verification.md)
