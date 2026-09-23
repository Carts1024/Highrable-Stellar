---
type: module
area: marketplace
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Applications and Milestones

## Purpose

Connect freelancer proposals to jobs and support multi-phase milestone projects with per-milestone assignment, escrow, deadlines, revisions, and continuation offers.

## Current Status

Implemented in Convex and represented in the marketplace UI. The backend milestone model is broader than the most polished micro-gig path.

## Primary Locations

- `packages/backend/convex/applications/{schema,mutations,queries,helpers}.ts`
- `packages/backend/convex/milestones/{schema,mutations,queries,helpers}.ts`
- `apps/web/features/marketplace/` hooks and pages
- `apps/web/features/jobs/`

## Responsibilities

- Prevent duplicate or ineligible applications and client self-application.
- Store proposals, optional showcased completed escrow IDs, and wallet type metadata.
- Create milestone projects, append/update milestones, assign one or many freelancers, and gate later milestones.
- Track continuation offers to a prior freelancer and replacement/reopening states.
- Mirror milestone escrow transaction hashes and derive parent job status from milestone state.

## Main Entry Points

- Applications: `applyToJob`, `applyToMilestone`, and list/eligibility queries.
- Milestones: `createMilestoneProject`, `addMilestoneToProject`, `updateMilestone`, `assignFreelancerToMilestone`, `offerMilestoneContinuation`, `respondToMilestoneContinuation`, `openMilestoneForReplacement`, `assignFreelancerToMultipleMilestones`, `createMilestoneEscrowRecord`, `updateMilestoneEscrowStatus`.

## Data Model

`applications` points to a `jobId` and optional `milestoneId`, with freelancer wallet, proposal, and timestamp. `milestones` points to a job, has order/amount/asset, status, deadline/revision data, assigned freelancer, application gate state, continuation fields, escrow ID, and operation tx hashes.

## External Dependencies

Convex IDs, wallet identity, supported escrow assets, contract transaction hashes, and agreement/deadline policy.

## Internal Dependencies

Jobs, escrows, agreements, deadlines, revisions, users, and dashboard queries.

## Important Flows

```text
milestone project(open job)
  → milestone application gate open
  → assign freelancer
  → create/fund milestone escrow
  → submit/revise/release or cancel/dispute
  → unlock/offer the next milestone
```

## Common Change Locations

Use milestone helpers for parent-status and gate invariants. Change application validation in `applications/helpers.ts`. Frontend escrow actions split between `use-escrow-actions.ts` and `use-milestone-escrow-actions.ts`.

## Risks / Gotchas

- A milestone project has several related status machines; do not update the parent job without checking milestone helpers.
- Later milestone availability is policy-driven, not just a UI filter.
- Wallet-address argument trust remains a backend security limitation.

## Related Notes

[[modules/Marketplace and Jobs]], [[modules/Escrow and Payments]], [[data/State Machines]]
