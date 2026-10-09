---
type: module
area: operations
status: current
last_updated: 2026-10-09
source_of_truth: repository
---

# Disputes and Cancellations

## Purpose

Capture participant disputes/cancellations, evidence, responses, timeline events, on-chain state, and admin settlement/review operations.

## Current Status


Convex participant/admin workflow and Soroban dispute marking/settlement are implemented. The owner-managed dispute-admin team, assignment workflow, and server-side settlement recovery are implemented in source but require a fresh isolated contract deployment/database before activation. C06 centralizes the frontend dispute contract in `apps/web/features/disputes/types.ts` and `lib.ts` and publishes the frozen handoff at `docs/instawards/C06-Frontend-Handoff.md`. C07 gates participant detail reads on `canViewDispute`, validates the detail route parameter, and adds explicit participant loading, forbidden, missing, empty, and failed-read route states. C11 adds explicit title and bounded related-record selection to the participant opening form, requires backend escrow eligibility before creation, shows creation/marking phases, and preserves the saved dispute ID after a marking failure so the form cannot create a duplicate case. C15 keeps the participant list scoped to the active wallet, renders readable actor and status transitions from Convex dispute events, and isolates timeline read errors so the dispute detail remains visible with a timeline retry. This remains a platform-reviewed workflow, not decentralized arbitration.
Convex participant/admin workflow and Soroban dispute marking/settlement are implemented. C05 hardens dispute parent authorization, C09 hardens related-record validation and the opening audit, C13 hardens idempotent on-chain marking callbacks, and C17 hardens all five administrator settlement callbacks without changing public arguments, persisted schema, statuses, indexes, or requiring a migration. This remains a platform-reviewed workflow, not decentralized arbitration.
Convex participant/admin workflow and Soroban dispute marking/settlement are implemented. C16 adds versioned Soroban `dispute/marked` and `dispute/resolved` events to the escrow source; their frozen interface is in `docs/instawards/C16-Dispute-Event-Handoff.md`. No indexer or backend event ingestion consumes them, and existing deployments do not emit them. The owner-managed dispute-admin team, assignment workflow, and server-side settlement recovery are implemented in source but require a fresh isolated contract deployment/database before activation. C06 centralizes the frontend dispute contract in `apps/web/features/disputes/types.ts` and `lib.ts` and publishes the frozen handoff at `docs/instawards/C06-Frontend-Handoff.md`. C07 gates participant detail reads on `canViewDispute`, validates the detail route parameter, and adds explicit participant loading, forbidden, missing, empty, and failed-read route states. C11 adds explicit title and bounded related-record selection to the participant opening form, requires backend escrow eligibility before creation, shows creation/marking phases, and preserves the saved dispute ID after a marking failure so the form cannot create a duplicate case. This remains a platform-reviewed workflow, not decentralized arbitration.

## Primary Locations

- `packages/backend/convex/disputes/`
- `packages/backend/convex/cancellations/`
- `packages/backend/convex/admin/`
- `contracts/escrow/src/lib.rs`
- `apps/web/features/disputes/`, `cancellations/`, `admin/`
- `apps/web/app/disputes/`, `app/admin/disputes/`

## Responsibilities

- Open disputes with reason, evidence, related submissions/revisions/messages/deadlines, and agreement context.
- Let participants respond, add evidence, and track `mark_disputed` transaction phases.
- Model cancellation eligibility, freelancer response, expiration, on-chain cancel state, and event history.
- Let active dispute admins claim unassigned nonterminal cases; only the assigned admin may add notes, change review status, or start settlement. The owner manages membership and assignment.
- Keep settlement attempts single-active per escrow, preserve the acting wallet and terms, and reconcile the signed transaction before applying terminal parent-state updates.

## Main Entry Points

Disputes: `createDispute`, `markDisputeOnChainStarted/Succeeded/Failed`, `addDisputeEvidence`, `addDisputeResponse`, `changeDisputeStatus`, `recordDisputeResolution`, and timeline/permission queries. Cancellations: `createCancellationRequest`, `respondToCancellationRequest`, `markCancellationApproved`, `markCancelOnChainStarted/Succeeded/Failed`, `expireCancellationRequest`, and eligibility queries. Admin settlement routes use `recordDisputeResolutionStarted/Signed/SubmissionUnknown/Succeeded/Failed`. Participant query-result and mutation-argument aliases are exported from `features/disputes/types.ts`; status labels, filter options, and terminal classification are exported from `features/disputes/lib.ts`.

## Data Model

`disputes` stores optional assignee wallet/time/actor fields in addition to participants, parent links, evidence, status, on-chain status, settlement, and timestamps. `disputeAssignmentEvents` records claims, release, and owner reassignment. `settlementAttempts` fixes the actor, share, note, operation ID, signed hash/expiry, scope, and phase. `disputeAdmins` and `disputeAdminOperations` hold owner-managed network/contract-scoped membership and recovery state. `disputeEvents` remains the dispute timeline; cancellations use their separate policy/status model.

## External Dependencies

Escrow contract `mark_disputed`/`resolve_dispute`, wallet/passkey execution, attachments, and admin session/API secret.

## Internal Dependencies

Escrows, jobs, milestones, work submissions, revisions, agreements, conversations, notifications, and transactions.

## Important Flows

```text
participant opens dispute
  → Convex evidence/timeline
  → on-chain mark disputed (hashless retry only if not submitted; known hashes require reconciliation)
  → active admin claim or owner assignment
  → assigned admin review
  → persist signed transaction identity before submission
  → server verifies contract/escrow/actor/split and current escrow state
  → idempotent Convex settlement record and parent terminal-state patch
```

On-chain dispute marking callbacks are phase-guarded. A start in `not_marked` enters `marking`; a start in `mark_failed` is retryable only when no transaction hash is recorded; duplicate starts while `marking` are no-ops. Success is accepted from `marking` or `mark_failed` only when its hash does not conflict with the stored hash, while a same-hash success replay after `marked` is a no-op. Failure is accepted from `marking`, preserves the first failure and any known hash, and does not repeat messages or notifications on replay. A failure may fill an absent hash without repeating side effects. Stale failures after `marked` are ignored; conflicting hashes, known-hash retries, impossible phase transitions, and state-changing callbacks for terminal review statuses are rejected. Accepted retries and successes clear only the current `onChainMarkError`; historical failure events remain.

Cancellation is blocked by submitted proof or active disputes according to its eligibility helpers. Contract cancellation is only valid for `Created` or `Funded`; a `Submitted` escrow must use dispute/review paths.

## Deliverable 2 C14 — Marking Callback and Retry Evidence

First-failure audit messages, system messages, and notifications now use the effective stored-or-incoming hash to distinguish reconciliation-required failures from hashless failures. Hashless guidance permits retry only if the operation was not submitted; otherwise the outcome needs reconciliation. Audit and system-message transaction references retain a previously stored hash even when the failure callback omits it. Existing authorization, guards, callback arguments, boolean returns, validators, statuses, and schema remain unchanged.

`packages/backend/tests/disputes/c14.marking.test.ts` adds 50 cases across micro-gig and milestone parents: all terminal-status/phase combinations, rejected late hash enrichment, authorization before replay returns, repeated hashless retry cycles, late-hash recovery, and incoming/stored hash guidance. Rejected/replayed callbacks compare complete records and timestamps with an advanced clock. Accepted transitions assert exact side-effect counts; enrichment changes only the missing hash, preserving first-failure details and historical side effects.

C13/C21 retain actor attribution (external-wallet, passkey, configured admin), initial phase, and existing reconciliation coverage. The combined suites pass 86 tests; the full backend suite passes 312 tests across 12 files. Backend/test TypeScript and scoped oxlint/oxfmt checks pass. See the [C14 evidence map](../../instawards/Deliverable-2-C14-Marking-Evidence.md).

This is local Convex bookkeeping evidence, not independent on-chain verification. Caller-supplied wallet possession remains unproven. Without attempt IDs, callbacks from separate hashless attempts cannot always be distinguished; hash absence is not proof of non-submission. Known-hash recovery uses existing reconciliation boundaries, with no new reconciliation service or deployment.

## Common Change Locations

Use domain helpers for participant roles and eligibility. Use admin helpers for status/settlement mapping. Update application dispute timeline/system-message/notification side effects and parent escrow/job/milestone patches when changing a terminal flow. The Soroban events are a separate future-consumption interface and currently do not populate the Convex dispute timeline.

## Frontend Contract and Limits

Deliverable 2 C24 adds a complete local participant acceptance journey from denied access through evidence/response and uncertain saved-hash marking to authoritative confirmation. Confirmed `marked` state now suppresses an obsolete local pending-outcome error; genuine `confirmed_sync_pending` bookkeeping failures retain recording recovery. No new transaction or duplicate case is created by these recovery paths. See [C24 evidence and commit map](../../instawards/Deliverable-2-C24-Participant-Acceptance-Evidence.md).

Participant reads remain identity-scoped at the UI layer and use the generated Convex API contract. Current bounded reads are 50 client plus 50 freelancer disputes before deduplication, 20 parent disputes, 200 timeline events, and 50 each for context submissions, revisions, and deadline events. Admin queue/detail limits and the complete participant function/argument matrix are frozen in `docs/instawards/C06-Frontend-Handoff.md`. Admin HTTP errors remain separate from participant Convex errors; both use explicit loading, empty, invalid/not-found, forbidden, and failed-read presentation.

C19 adds separate participant evidence and response composers to permitted dispute details. Both wait for `canRespondToDispute`, use its returned participant role for uploads, require ready attachments within the 25-file mutation limit, and retain drafts after rejected writes. Evidence requires an attachment; responses require a message. Participant detail and timeline read serialized attachments through the dispute queries, while protected previews and download attempts use backend attachment access functions. The backend still validates actor role, active status, attachment ownership, and case association for every write; caller-supplied wallet possession remains unproven.

C23 distinguishes saved, marking, uncertain, hash-recorded failure, and confirmed escrow-marking states in the participant UI. A hash-recorded or possibly submitted attempt cannot be retried from the participant detail page until reconciliation; a pre-submission failure without a hash can be retried with a new operation ID. The browser persists signed external-wallet hashes in pending transaction records, labels simulation/signing/submission/confirmation phases, and derives Stellar Expert links from transaction hashes rather than stored URLs. After chain confirmation, recording failures remain distinct from chain failures and can be retried as bookkeeping without submitting another Stellar operation. The opening dialog retains the saved case and any known hash when marking is uncertain.

C24 verifies the detail page, action gate, evidence and response forms, and timeline together with wallet-scoped query and submission tests. Opening and composer forms use native submit buttons with announced, associated errors. The timeline list is named. Attachment uploaders use unique label targets when both forms are present, and a disabled dropzone is removed from keyboard navigation and cannot open the picker. The six participant commit IDs and verification commands are recorded in `docs/instawards/C24-Participant-Frontend-Verification.md`.

## Deliverable 2 C09 — Participant Form Recovery

Participant evidence and response composers now consume an in-memory action session keyed by dispute ID, wallet address, and wallet type. The session owns separate drafts, attachment references, readable errors, pending state, and duplicate-submit locks for each form above the participant permission-query error boundary. Permission loading, denial, thrown-query recovery, and retry therefore remove or remount the forms without losing the same-case, same-wallet drafts; forms render only after `canRespondToDispute` returns an allowed participant role, which remains the upload role. Evidence and response submissions remain independent, successful writes clear only their own draft, and rejected writes preserve text and attachments.

The session is intentionally ephemeral. Case navigation, wallet address or wallet-type changes, disconnect, and participant-page unmount replace or discard it; full page reloads and removal of the detail page also discard drafts. Async upload and mutation completions retain the identity of their original keyed session and cannot clear or populate a replacement session. No durable browser storage, schema, generated API, Convex signature, Stellar transaction, or contract behavior changed.

Participant regression coverage is in `apps/web/features/disputes/components/dispute-participant-actions.test.tsx`, `dispute-participant-integration.test.tsx`, and `participant-submission.test.ts`. The focused participant command passes 16 tests; `pnpm --filter web test features/disputes` passes 50 tests across 9 files; web TypeScript, scoped oxlint, and scoped oxfmt checks pass. This is mocked local UI evidence only and does not verify live Convex, wallet possession, Stellar RPC, transaction signing/submission, or deployed contracts.

## Deliverable 2 C10 - Participant Timeline Regression Coverage

`apps/web/features/disputes/components/dispute-timeline.test.tsx` now uses typed fixtures derived from `TParticipantDisputeTimelineQueryResult`. The fixture set covers all 14 Convex event types, client/freelancer/moderator/system actors, optional status transition fields, serialized event attachments, and transaction links. Function-and-argument keyed query fixtures verify wallet and dispute changes reset timeline errors and replace prior events; repeated failures remain recoverable through the readable alert and retry button without exposing raw backend messages.

`dispute-participant-integration.test.tsx` keeps the real participant detail panel, action composers, and timeline together. It proves a timeline read failure preserves case details and participant drafts, retry restores events without mutations or Stellar operations, permission revocation and disconnect remove the real timeline, and restored access queries the current participant and dispute. Existing C04 list, route, and status-label coverage remains the acceptance evidence for those concerns rather than being duplicated.

The focused `pnpm --filter web test features/disputes` command passes 54 tests across 9 files. Web TypeScript, scoped oxlint, and scoped oxfmt checks pass. This is mocked local UI evidence only; it does not verify live Convex, wallet possession, Stellar RPC, transaction execution, or deployed contracts. The C10 evidence map is `docs/instawards/Deliverable-2-C10-Participant-Timeline-Evidence.md`.

## Deliverable 2 C11 - Admin Evidence Review

Administrator detail review now displays case-level evidence separately from the event timeline through a shared `AdminEvidenceList`. It preserves event association, shows attachment metadata, renders missing references as `Evidence unavailable`, distinguishes empty evidence, and allows only active records with validated storage or external HTTP/HTTPS URLs to open in a new tab. Deleted, blocked, missing, null-URL, and unsafe records remain non-actionable.

The manual detail refresh is read-only and identity-scoped through the existing protected admin query. It replaces server-returned evidence/status, prevents duplicate refreshes, and removes stale content for 404/authorization failures while retaining retryable network/5xx errors. Real session-gate integration covers assigned-admin rendering, wallet changes, disconnects, and late detail responses; focused administrator coverage passes 173 tests and the full web suite passes 286 tests. This is mocked UI/session/API evidence, not live Convex, storage, or Stellar verification. The evidence map is `docs/instawards/Deliverable-2-C11-Admin-Evidence-Review-Evidence.md`.

## C04 participant route regression coverage

`apps/web/features/disputes/components/dispute-route-states.test.tsx` now uses query fixtures keyed by Convex function and arguments, with explicit loading, result, and thrown-error states. Its 12 tests cover wallet-scoped list refresh/disconnect behavior; accessible recovery through the real participant route fallback for list, permission, detail, and agreement reads without exposing raw errors; permission-gated detail loading, missing and revoked access, dispute-ID navigation, current-wallet arguments, and suppression of evidence/actions/timeline before access; and every typed review and on-chain marking badge label while keeping the two status vocabularies separate. `apps/web/app/disputes/[disputeId]/page.test.tsx` adds 2 route-entry tests proving malformed IDs call `notFound()` before the detail panel and valid-looking IDs reach the existing participant permission flow.

The requested focused command, `pnpm --filter web test features/disputes`, passes 41 tests across 8 files. The route-entry file passes 2/2 with `pnpm --filter web exec vitest run 'app/disputes/[disputeId]/page.test.tsx'`; web TypeScript, focused oxlint, and focused oxfmt checks pass. This is mocked component and route-entry regression evidence only; it does not verify browser behavior, live Convex, Stellar RPC, transactions, or deployed contracts. No production dispute API, schema, status vocabulary, wallet identity handling, or contract behavior changed.

## Risks / Gotchas

- `resolve_dispute` emits the supplied resolution hash in its Soroban event but does not store it in the escrow record.
- App case assignment is enforced by Convex. As selected, the contract permits any active, non-conflicted dispute admin to settle directly without checking app assignment.
- Existing cases are unassigned. Owner assignment/release is blocked during a pending or submission-unknown settlement. A revoked admin's assignment remains visible for owner reassignment.
- The new membership and contract conflict rules are not present in currently recorded deployments; activate only with a fresh isolated deployment/database. Existing ID lookup/synchronization is not safe across overlapping contract ID spaces.
- C16 event emission is present only in current source, not existing deployments; reputation events and event indexing/ingestion remain absent.
- `freelancer_share_bps == 0` becomes contract `Cancelled`; any positive share becomes `Released`, including a client-refund split.
- Contract settlement does not write a reputation completion record.
- Convex public participant checks are not the same as signed-session possession proof.
- Participant authentication remains limited: caller-supplied wallet arguments are checked by participant helpers, but participant Convex reads/mutations do not have the admin routes' signed-session possession proof.

## C05 Verified Invariants

- Dispute parent IDs are normalized against their expected Convex table before reads. Jobs, milestones, escrows, parent-job links, milestone-job links, escrow client ownership, and the applicable job/milestone freelancer assignment must all resolve consistently.
- Milestone projects require a specific milestone or escrow parent. `job` is accepted as a micro-gig alias, and jobs with omitted `jobType` retain legacy micro-gig behavior. A milestone's on-chain escrow reference is checked when present, and ambiguous job/milestone escrow matches are rejected.
- Only assigned escrows in `funded` or `submitted` status are eligible. Query eligibility and mutation creation both call `assertCanOpenDispute`; active duplicate checks query each active status index directly, so closed-history volume cannot hide an active dispute.
- Creation and participant/audit checks share normalized client/freelancer role resolution. Opening and audit roles continue to come from backend-resolved records; a configured administrator who is not a participant cannot use the participant creation mutation. Admin review still requires the configured wallet and Convex secret.
- The original C05 coverage extends the C02 in-memory harness with participant/status/parent combinations, malformed and wrong-table IDs, missing and conflicting records, aliases and legacy jobs, ambiguous and unassigned escrows, >50 closed disputes, nonparticipants, admin credentials, and creation side-effect rollback. Deliverable 2 C05 expands that matrix and preserves the caller-supplied participant wallet limitation because this flow does not prove wallet possession.

## C08 Verified Invariants

- `validateDisputeAttachmentIds` enforces the raw 25-item request limit before deduplicating IDs in first-seen order, validates each unique active caller-owned attachment, and returns typed attachment IDs. Creation still requires unlinked attachments; subsequent evidence/response writes accept an attachment unlinked or already attached to the same dispute.
- `createDispute`, `addDisputeEvidence`, and `addDisputeResponse` use the returned IDs for attachment reassignment, dispute evidence arrays, and audit-event attachments. Supplied evidence/response messages are sanitized before any mutation write. The public arguments, result values, statuses, schemas, and indexes remain unchanged; the two participant mutations now declare their existing boolean result validators explicitly.
- Related submission, revision, message, and deadline arrays retain their raw 20-item-per-array limits and first-seen deduplication. Legacy optional links, shared parent-job conversations, system messages, empty response attachments, and caller-owned attachments already on the same dispute remain compatible. Deduplication is request-scoped and does not add cross-request idempotency.
- `packages/backend/tests/disputes/c08.evidence.test.ts` adds 23 deterministic public-mutation tests covering micro-gigs/milestones, both participant roles and wallet types, duplicate and boundary limits, attachment ownership/status/table/case checks, submission/revision/message/deadline relationships, unrelated/terminal actors, side-effect recipients, and complete rollback snapshots. The focused C08 suite passes 23 tests; the full backend suite passes 262 tests across 11 files. Backend source/test TypeScript, scoped oxlint, and scoped oxfmt checks pass. Evidence is local in-memory Convex bookkeeping, not signed-session possession, live RPC, deployed-contract, or external-service verification.

## Deliverable 2 C05 Verified Evidence

The focused `packages/backend/tests/disputes/c05.authorization.test.ts` suite passes 111 deterministic `convex-test` cases. Accepted creation covers client/freelancer openings, funded/submitted escrows, micro-gig, `job`, explicit micro-gig escrow, milestone, and explicit milestone escrow paths, including legacy jobs without `jobType`; each case agrees between `canOpenDispute` and `createDispute`, persists canonical parent links and backend-derived roles, and emits exactly one opening audit event.

Rejection coverage spans unrelated and configured-but-nonparticipant administrator wallets, profile-role mismatches, unassigned work, every non-eligible escrow status, malformed/missing/wrong-table/conflicting parent records, ownership and assignment mismatches, missing on-chain references, incompatible job/milestone links, ambiguous escrow selection, all active duplicate statuses and aliases, milestone-only conflicts, long closed history, and terminal-only history. Rejected writes compare complete before/after documents for disputes, evidence, audit events, notifications, conversations/messages, agreements/versions/events, and linked job/milestone/escrow records after seeding valid evidence and accepted agreement context.

The full backend suite passes 239 tests across 10 files. Backend source and test TypeScript projects, scoped oxlint, and oxfmt checks pass. No production, generated, frontend, contract, migration, or deployment files changed. These are local deterministic Convex bookkeeping tests; they do not prove signed-session wallet possession, live Stellar RPC execution, transaction signing/submission, deployed contract identity, or chain event ingestion.

## C09 Verified Invariants

- Every supplied evidence, submission, revision, message, and deadline reference is count-checked before deduplication, normalized against its expected Convex table, and validated before agreement-version creation or any dispute write. Submissions and revisions must resolve to the selected work, normalized client/freelancer identities, and non-conflicting job, milestone, escrow, and on-chain escrow links; omitted legacy links remain valid when the typed parent is sufficient. Revision-linked submissions are validated too.
- Message evidence requires a sent message, an existing conversation, matching message/conversation parent links, and membership for both dispute participants. Selected escrow/milestone threads, explicitly related submission threads, prior same-work dispute threads, and shared parent-job threads are accepted; direct, unrelated, and sibling-milestone threads are rejected. Deadline evidence must point to the exact selected milestone or micro-gig parent.
- Evidence remains active, caller-owned, and unlinked before opening. Raw evidence counts are checked before deduplication, and the deduplicated IDs are used consistently on the dispute, attachment reassignment, and single `dispute_opened` event. Creation remains atomic with canonical participants/parent links, backend-derived actor role, normalized actor wallet, sanitized description, opening timestamp, agreement context, notification, and best-effort system-message behavior.
- C09 adds deterministic in-memory coverage for aliases, funded/submitted micro-gigs and milestones, both wallet-type values, legacy links, shared conversations, previous disputes, limits, invalid references, participant/link conflicts, hidden messages, exact deadline parents, agreement context, evidence reassignment, notification recipients, and rollback. The suite now has 49 passing backend tests. Caller-supplied participant wallets remain a documented authentication limitation.

## Regression coverage

C02 adds an in-memory Convex regression harness under `packages/backend/tests/`. Fixtures seed the client, assigned freelancer, unrelated wallet, configured administrator, job, and funded/submitted escrow directly, with both micro-gig and milestone parent variants. Disputes are created through `api.disputes.createDispute`; administrator review and notes use `api.admin` with synthetic test-only configuration.

The verified suite locks the existing dispute/event schema values and index names/field order, proves independent client/freelancer opening with initial `open` and `not_marked` state plus an opening event, preserves `moderator` actor roles for admin events, and covers participant/parent/escrow/status/timeline lookups. Failure coverage includes unrelated participants, duplicate active disputes, invalid administrator wallets, and missing or incorrect admin secrets. The harness does not change production APIs, persisted fields, statuses, or indexes.

## Deliverable 2 C02 Verified Contract Handoff

Deliverable 2 C02 preserves the Deliverable 1 C02 schema/index/fixture foundation and adds compatibility coverage at the remaining boundaries. `schema.contract.test.ts` parameterizes all four parent types, nine reason categories, both wallet types, four marking phases, four event actor roles, fourteen event types, and optional event `oldStatus`/`newStatus` combinations. It also rejects unknown enum members, incorrect types, and wrong-table IDs. `index.contract.test.ts` proves `by_assignedAdmin_updatedAt` isolates administrators and orders each administrator's assigned disputes by `updatedAt`.

`api.contract.test.ts` references all 20 public `api.disputes` exports through the generated API, rejects missing/invalid/wrong-table/malformed arguments without changing records, locks participant present/missing/denied shapes including `null`, empty arrays, and the omitted-versus-null `canViewDispute.role` distinction, and preserves the legacy dispute moderator-note/resolution rejecting placeholders. Working review and settlement functions remain under `api.admin`. The handoff is frozen in `docs/instawards/C02-Backend-Contract-Handoff.md`.

Participant wallet identity remains caller-supplied and is not signed-session possession proof. Administrator operations use the trusted signed-session plus Convex secret/capability boundary. The focused C02 run passes 59 tests and the full backend suite passes 154 tests across 10 files. These are local in-memory Convex contract/bookkeeping tests; they do not prove Stellar chain execution, deployed contract IDs, transaction signing/submission, or Soroban event ingestion.

## C13 Verified Invariants

- The three on-chain marking mutations keep their frozen arguments, return booleans, and preserve the existing `not_marked`, `marking`, `marked`, and `mark_failed` values plus existing event types.
- Input normalization and participant/configured-admin authorization happen before every accepted transition or idempotent return. Caller-supplied wallet possession remains a documented limitation.
- Duplicate starts, successes, and failures do not repeat audit events, system messages, notifications, or timestamps. A retry-start adds one existing `on_chain_mark_started` event with retry wording; it does not create another dispute or opening event.
- Micro-gig and milestone fixtures cover client, freelancer, configured-admin, unrelated-wallet, external-wallet, and passkey-smart-account paths, including late success, stale failure, conflicting hashes, blank inputs, missing disputes, terminal review guards, and rejected-record preservation. The focused C13 suite passes 18 deterministic tests.

Known-hash failures remain blocked pending reconciliation. Hashless retries and callback ordering across separate browser submissions remain intentionally limited: this task does not add attempt IDs, signed-session authentication, frontend controls, a reconciliation service, or contract changes.

## C17 Verified Invariants

- Settlement starts require a non-conflicted assigned admin, a nonterminal dispute, a disputed escrow, integer basis points (`0`, `10_000`, or `1–9999` for the three resolution shapes), and a normalized non-empty operation ID. One active attempt is allowed per escrow; matching active replays are no-ops, while failed attempts require a new operation ID.
- Every callback checks the server secret, current scoped capability, assignment/attempt ownership, participant conflicts, and persisted escrow/network/contract identity before an idempotent return. Owner recovery remains available for an existing attempt and terminal attribution remains the initiating administrator.
- Signed callbacks accept only 64-hex transaction hashes and positive safe-integer expiries, persist the pair once, and preserve the current phase, timestamps, and first error across matching replays, including after `submission_unknown`. Unknown callbacks require the saved pair, keep the transaction pending/locked, and preserve the first uncertainty details.
- Success requires the persisted signed identity and the existing server-side chain verification boundary. It applies escrow, dispute, parent, transaction, audit, system-message, and notification updates atomically once; authorized matching replays are harmless. Failure supports unsigned failure or reconciliation with the matching saved hash, preserves the first failure and known hash, and suppresses duplicate or stale-success side effects.
- Explicit populated dispute/attempt contract and escrow references must match the configured scope and escrow. Legacy records may omit those optional dispute fields and continue using the linked escrow and current scope. Resolution audit metadata includes the operation ID; failure events include known hashes without adding event types.
- Terminal mappings remain `0 → resolved_client/cancelled`, `10_000 → resolved_freelancer/released`, and intermediate shares → `split_resolution/released`. `packages/backend/tests/disputes/c17.settlement.test.ts` covers both parent types, all mappings, malformed/conflicting inputs, authorization/replay paths, uncertainty recovery, atomic updates, and side-effect counts.

Payment-amount arithmetic is unchanged: payout bookkeeping still uses whole-unit truncation (`Math.trunc`) before the client refund is derived. Token-precision arithmetic is a separate follow-up and must be designed with asset decimals before changing settlement amounts.

## C21 Verified Invariants

- `packages/backend/tests/disputes/c21.reconciliation.test.ts` connects the C13 marking callbacks and C17 settlement callbacks to the existing escrow, micro-gig, milestone, parent-job, transaction, audit, notification, and system-message bookkeeping mutations.
- Hashless marking failures remain retryable; known-hash retries remain blocked until reconciliation; matching late success is accepted; conflicting callbacks and stale failures preserve confirmed records and side-effect counts.
- Settlement failures preserve their failed attempt and transaction history. Signed and `submission_unknown` operations retain their hash/expiry and block competing attempts until the matching success callback finalizes them.
- Client-refund, freelancer-payout, and split outcomes are covered for both parent types. Milestone settlement patches only the selected milestone and derives the parent job from remaining active, disputed, or terminal siblings.
- Generic sync can recover an escrow mirror to `disputed` and record repeated reads/failure metadata, but it refuses to downgrade or finalize a disputed escrow. Administrator settlement owns the terminal transition.
- The C21 suite verifies Convex transaction rollback when a required milestone parent fails during settlement. It remains an in-memory bookkeeping test and does not verify live RPC execution or deployed contract behavior.

## Deliverable 2 C19 Verified RPC Recovery

Deliverable 2 C19 hardens RPC record parsing and saved settlement verification. Escrow reads must match the requested ID; transaction verification must match the saved hash and expected invocation. Malformed reads remain retryable without finalizing records, and recovery never resubmits a transaction. The backend suite passes 361 tests and the web suite passes 330 tests, including 58 new C19 cases. See `docs/instawards/Deliverable-2-C19-RPC-Recovery-Evidence.md` for coverage and local-only evidence limits.

## Related Notes

[[modules/Admin Operations]], [[contracts/Escrow Contract]], [[data/State Machines]], [[backend/Admin and Server Routes]]
