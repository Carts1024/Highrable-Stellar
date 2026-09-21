---
type: module
area: delivery
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Work Submissions and Proof

## Purpose

Store proof-of-work metadata, attachments, revision relationships, agreement context, and on-chain proof anchoring state for an escrow/job/milestone.

## Current Status

Implemented with draft, review, revision, acceptance, anchoring, and retry states. Public escrow proof pages and protected attachment viewers exist. Privacy and file-integrity controls remain incomplete.

## Primary Locations

- `packages/backend/convex/work_submissions/{schema,queries,mutations,helpers}.ts`
- `packages/backend/convex/proofs.ts`
- `packages/backend/convex/revisions/`
- `apps/web/features/work-submissions/`, `proof/`, `attachments/`
- `apps/web/app/proof/[escrowId]/page.tsx`

## Responsibilities

- Validate lowercase 64-character SHA-256 proof hashes and sanitized notes.
- Link submissions to job/milestone/escrow, agreement version, revision request, attachments, and deadline status.
- Enforce assigned-freelancer ownership for creation/anchoring and participant visibility for viewing.
- Track `not_submitted`, `pending`, `confirmed`, and `failed` on-chain anchor states.
- Render proof data with linked reputation, profiles, timeline, and escrow context.

## Main Entry Points

Convex: `createWorkSubmissionDraft`, `submitWorkProofMetadata`, `markSubmissionAnchoring`, `markSubmissionAnchored`, `markSubmissionAnchorFailed`, `retrySubmissionAnchor`, `acceptPreviewSubmission`, and submission queries. The actual Soroban anchor uses the escrow helper `submitWorkOnChain` with `submit_work`.

## Data Model

`workSubmissions` stores notes, attachment IDs, normalized manifest, proof hash/encoding/version, workflow/on-chain status, tx/error fields, accepted/submitted/anchored timestamps, and deadline metadata. `attachments` stores the file/link object separately and access logs record viewer actions.

## External Dependencies

Convex storage, optional external links, direct Soroban `submit_work`, and client-side hash/manifest preparation.

## Internal Dependencies

Escrows, jobs, milestones, agreements, revisions, deadlines, disputes, cancellations, and conversations.

## Important Flows

```text
draft → submitted_for_review → accepted_for_final/submitted
      ↘ revision_requested → revision_submitted → accepted_for_final
submitted/accepted_for_final → anchoring → anchored or anchor_failed → retry
```

## Common Change Locations

Change proof validation/permissions in `work_submissions/helpers.ts`; state mutations in `mutations.ts`; proof composition in `proofs.ts`; protected viewer/access policy in `attachments/`.

## Risks / Gotchas

- A proof hash commits metadata, not necessarily raw file bytes; attachment checksum capture is still a follow-up TODO.
- Submitted/anchored states become read-only through helper guards.
- Public proof pages and attachment visibility are separate concerns; do not infer that a public proof makes all attachments public.

## Related Notes

[[modules/Work Agreements]], [[modules/Collaboration]], [[contracts/Escrow Contract]], [[data/State Machines]]
