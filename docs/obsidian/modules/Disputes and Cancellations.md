---
type: module
area: operations
status: current
last_updated: 2026-09-28
source_of_truth: repository
---

# Disputes and Cancellations

## Purpose

Capture participant disputes/cancellations, evidence, responses, timeline events, on-chain state, and admin settlement/review operations.

## Current Status

Convex participant/admin workflow and Soroban dispute marking/settlement are implemented. C06 centralizes the frontend dispute contract in `apps/web/features/disputes/types.ts` and `lib.ts`, derives status/actor/parent fields from generated Convex documents, and publishes the frozen participant handoff at `docs/instawards/C06-Frontend-Handoff.md`. This remains a platform-reviewed workflow, not decentralized arbitration.
Convex participant/admin workflow and Soroban dispute marking/settlement are implemented. C05 hardens dispute parent authorization and creation invariants without changing public arguments, return shapes, schema, statuses, indexes, or requiring a migration. This remains a platform-reviewed workflow, not decentralized arbitration.

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
- Let the configured admin review, add notes, change review status, and record settlement phases.

## Main Entry Points

Disputes: `createDispute`, `markDisputeOnChainStarted/Succeeded/Failed`, `addDisputeEvidence`, `addDisputeResponse`, `changeDisputeStatus`, `recordDisputeResolution`, and timeline/permission queries. Cancellations: `createCancellationRequest`, `respondToCancellationRequest`, `markCancellationApproved`, `markCancelOnChainStarted/Succeeded/Failed`, `expireCancellationRequest`, and eligibility queries. Admin settlement routes call `recordDisputeResolutionStarted/Succeeded/Failed`. Participant query-result and mutation-argument aliases are exported from `features/disputes/types.ts`; status labels, filter options, and terminal classification are exported from `features/disputes/lib.ts`.

## Data Model

`disputes` stores participants, parent links, evidence/related records, status, on-chain status, tx hashes, split basis points, payout/refund amounts, resolution note, and timestamps. `disputeEvents` is the timeline. `cancellationRequests` and `cancellationEvents` use a separate policy/status model.

## External Dependencies

Escrow contract `mark_disputed`/`resolve_dispute`, wallet/passkey execution, attachments, and admin session/API secret.

## Internal Dependencies

Escrows, jobs, milestones, work submissions, revisions, agreements, conversations, notifications, and transactions.

## Important Flows

```text
participant opens dispute
  → Convex evidence/timeline
  → on-chain mark disputed (retryable if failed)
  → admin review
  → 0/partial/10000 bps contract resolution
  → Convex settlement record and parent terminal-state patch
```

Cancellation is blocked by submitted proof or active disputes according to its eligibility helpers. Contract cancellation is only valid for `Created` or `Funded`; a `Submitted` escrow must use dispute/review paths.

## Common Change Locations

Use domain helpers for participant roles and eligibility. Use admin helpers for status/settlement mapping. Update both event/system-message/notification side effects and parent escrow/job/milestone patches when changing a terminal flow.

## Frontend Contract and Limits

Participant reads remain identity-scoped at the UI layer and use the generated Convex API contract. Current bounded reads are 50 client plus 50 freelancer disputes before deduplication, 20 parent disputes, 200 timeline events, and 50 each for context submissions, revisions, and deadline events. Admin queue/detail limits and the complete participant function/argument matrix are frozen in `docs/instawards/C06-Frontend-Handoff.md`. Admin HTTP errors remain separate from participant Convex errors; both use explicit loading, empty, invalid/not-found, forbidden, and failed-read presentation.

## Risks / Gotchas

- `resolve_dispute` stores no resolution hash despite accepting the argument.
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

## Regression coverage

C02 adds an in-memory Convex regression harness under `packages/backend/tests/`. Fixtures seed the client, assigned freelancer, unrelated wallet, configured administrator, job, and funded/submitted escrow directly, with both micro-gig and milestone parent variants. Disputes are created through `api.disputes.createDispute`; administrator review and notes use `api.admin` with synthetic test-only configuration.

The verified suite locks the existing dispute/event schema values and index names/field order, proves independent client/freelancer opening with initial `open` and `not_marked` state plus an opening event, preserves `moderator` actor roles for admin events, and covers participant/parent/escrow/status/timeline lookups. Failure coverage includes unrelated participants, duplicate active disputes, invalid administrator wallets, and missing or incorrect admin secrets. The harness does not change production APIs, persisted fields, statuses, or indexes.

## Related Notes

[[modules/Admin Operations]], [[contracts/Escrow Contract]], [[data/State Machines]], [[backend/Admin and Server Routes]]
