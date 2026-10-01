---
type: module
area: operations
status: current
last_updated: 2026-09-30
source_of_truth: repository
---

# Disputes and Cancellations

## Purpose

Capture participant disputes/cancellations, evidence, responses, timeline events, on-chain state, and admin settlement/review operations.

## Current Status

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
  → on-chain mark disputed (retryable if failed)
  → active admin claim or owner assignment
  → assigned admin review
  → persist signed transaction identity before submission
  → server verifies contract/escrow/actor/split and current escrow state
  → idempotent Convex settlement record and parent terminal-state patch
```

On-chain dispute marking callbacks are phase-guarded. A start in `not_marked` enters `marking`; a start in `mark_failed` is retryable only when no transaction hash is recorded; duplicate starts while `marking` are no-ops. Success is accepted from `marking` or `mark_failed` only when its hash does not conflict with the stored hash, while a same-hash success replay after `marked` is a no-op. Failure is accepted from `marking`, preserves the first failure and any known hash, and does not repeat messages or notifications on replay. A failure may fill an absent hash without repeating side effects. Stale failures after `marked` are ignored; conflicting hashes, known-hash retries, impossible phase transitions, and state-changing callbacks for terminal review statuses are rejected. Accepted retries and successes clear only the current `onChainMarkError`; historical failure events remain.

Cancellation is blocked by submitted proof or active disputes according to its eligibility helpers. Contract cancellation is only valid for `Created` or `Funded`; a `Submitted` escrow must use dispute/review paths.

## Common Change Locations

Use domain helpers for participant roles and eligibility. Use admin helpers for status/settlement mapping. Update application dispute timeline/system-message/notification side effects and parent escrow/job/milestone patches when changing a terminal flow. The Soroban events are a separate future-consumption interface and currently do not populate the Convex dispute timeline.

## Frontend Contract and Limits

Participant reads remain identity-scoped at the UI layer and use the generated Convex API contract. Current bounded reads are 50 client plus 50 freelancer disputes before deduplication, 20 parent disputes, 200 timeline events, and 50 each for context submissions, revisions, and deadline events. Admin queue/detail limits and the complete participant function/argument matrix are frozen in `docs/instawards/C06-Frontend-Handoff.md`. Admin HTTP errors remain separate from participant Convex errors; both use explicit loading, empty, invalid/not-found, forbidden, and failed-read presentation.

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
- C05 coverage extends the C02 in-memory harness to 40 backend tests, including all participant/status/parent combinations, malformed and wrong-table IDs, missing and conflicting records, aliases and legacy jobs, ambiguous and unassigned escrows, >50 closed disputes, nonparticipants, admin credentials, and creation side-effect rollback. Caller-supplied participant wallets remain a documented limitation because this flow does not prove wallet possession.

## C09 Verified Invariants

- Every supplied evidence, submission, revision, message, and deadline reference is count-checked before deduplication, normalized against its expected Convex table, and validated before agreement-version creation or any dispute write. Submissions and revisions must resolve to the selected work, normalized client/freelancer identities, and non-conflicting job, milestone, escrow, and on-chain escrow links; omitted legacy links remain valid when the typed parent is sufficient. Revision-linked submissions are validated too.
- Message evidence requires a sent message, an existing conversation, matching message/conversation parent links, and membership for both dispute participants. Selected escrow/milestone threads, explicitly related submission threads, prior same-work dispute threads, and shared parent-job threads are accepted; direct, unrelated, and sibling-milestone threads are rejected. Deadline evidence must point to the exact selected milestone or micro-gig parent.
- Evidence remains active, caller-owned, and unlinked before opening. Raw evidence counts are checked before deduplication, and the deduplicated IDs are used consistently on the dispute, attachment reassignment, and single `dispute_opened` event. Creation remains atomic with canonical participants/parent links, backend-derived actor role, normalized actor wallet, sanitized description, opening timestamp, agreement context, notification, and best-effort system-message behavior.
- C09 adds deterministic in-memory coverage for aliases, funded/submitted micro-gigs and milestones, both wallet-type values, legacy links, shared conversations, previous disputes, limits, invalid references, participant/link conflicts, hidden messages, exact deadline parents, agreement context, evidence reassignment, notification recipients, and rollback. The suite now has 49 passing backend tests. Caller-supplied participant wallets remain a documented authentication limitation.

## Regression coverage

C02 adds an in-memory Convex regression harness under `packages/backend/tests/`. Fixtures seed the client, assigned freelancer, unrelated wallet, configured administrator, job, and funded/submitted escrow directly, with both micro-gig and milestone parent variants. Disputes are created through `api.disputes.createDispute`; administrator review and notes use `api.admin` with synthetic test-only configuration.

The verified suite locks the existing dispute/event schema values and index names/field order, proves independent client/freelancer opening with initial `open` and `not_marked` state plus an opening event, preserves `moderator` actor roles for admin events, and covers participant/parent/escrow/status/timeline lookups. Failure coverage includes unrelated participants, duplicate active disputes, invalid administrator wallets, and missing or incorrect admin secrets. The harness does not change production APIs, persisted fields, statuses, or indexes.

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

## Related Notes

[[modules/Admin Operations]], [[contracts/Escrow Contract]], [[data/State Machines]], [[backend/Admin and Server Routes]]
