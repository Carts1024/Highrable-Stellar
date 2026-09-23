---
type: module
area: delivery
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Work Agreements

## Purpose

Represent client-uploaded or Highrable-generated terms, review/acceptance, immutable versions, amendments, locking, and references from proof, revision, dispute, and cancellation flows.

## Current Status

Implemented in Convex and integrated into work-start/proof guards. Agreement file-integrity hashing is not complete for all source uploads.

## Primary Locations

- `packages/backend/convex/work_agreements/{schema,queries,mutations,helpers}.ts`
- `apps/web/features/work-agreements/`
- `apps/web/app/work-agreements/[agreementId]/review/page.tsx`

## Responsibilities

- Create drafts from uploaded source or generated snapshots.
- Normalize content and store rich-text/markdown representations.
- Create version rows, snapshots, SHA-256 agreement hashes, and event audit rows.
- Send, accept, reject, revise rejected versions, confirm, lock, cancel, and propose/accept/reject amendments.
- Gate proof submission/work start on accepted agreements, with legacy exemptions for already-progressed records.

## Main Entry Points

Mutations include `createWorkAgreementDraft`, `createClientUploadedAgreement`, `generateHighrableWorkAgreement`, `markWorkAgreementReadyToSend`, `sendAgreementForAcceptance`, `acceptWorkAgreement`, `rejectWorkAgreement`, `confirmAcceptedAgreement`, `lockWorkAgreement`, amendment operations, and reference/export event operations. Queries include review, active version, audit timeline, contextual proof/revision/dispute/cancellation checks, and permission checks.

## Data Model

`workAgreements` is the current aggregate; `workAgreementVersions` stores versioned content, snapshots, terms, acceptance, lock, payment asset, deadline, revision, and protection data; `workAgreementEvents` is the audit timeline.

## External Dependencies

Convex storage/attachments for client-uploaded files and the frontend review/editor components.

## Internal Dependencies

Jobs, milestones, escrows, work submissions, revisions, disputes, cancellations, notifications, and conversations.

## Important Flows

```text
draft → ready_to_send → pending_acceptance → accepted → locked
                                      ↘ rejected → revise or abandon
locked → amendment proposed → new version accepted/locked or rejected
```

Escrow funding can lock an accepted agreement. Work submission and start guards query the accepted agreement context before allowing progression.

## Common Change Locations

Use `work_agreements/helpers.ts` for participant/status/immutability invariants and snapshot/hash construction. Use mutations for side effects and event/notification creation. Use the feature slice for review UX only.

## Risks / Gotchas

- Accepted/locked content should be treated as immutable; amendments create versions rather than mutating the locked snapshot.
- Agreement source-file content hashing is explicitly a TODO in the helper path.
- Permission checks use participant wallet arguments and admin role checks; public signed-session hardening is not complete.

## Related Notes

[[modules/Work Submissions and Proof]], [[modules/Disputes and Cancellations]], [[data/State Machines]]
