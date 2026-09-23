---
type: module
area: marketplace
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Marketplace and Jobs

## Purpose

Create, browse, inspect, and select freelance jobs. Jobs are the product-level parent for applications, agreements, deadlines, escrows, submissions, disputes, and proof pages.

## Current Status

Implemented for micro gigs and milestone projects. The marketplace and job-detail UI is the most complete product path; trust/safety notices and job reports are included. `/talent` is not a live directory.

## Primary Locations

- `packages/backend/convex/jobs/{schema,mutations,queries,helpers,scamSignals}.ts`
- `packages/backend/convex/reports.ts` and `reports/schema.ts`
- `apps/web/features/marketplace/`
- `apps/web/features/jobs/`
- `apps/web/features/post-job/`
- `apps/web/app/marketplace/`, `app/jobs/`, `app/post-job/`

## Responsibilities

- Store job title, description, budget, asset, client wallet, job type, deadline, revision policy, hash, and lifecycle status.
- Reject disallowed scam language such as requests for seed phrases/private keys.
- List marketplace rows with application/escrow context used by safety-aware UI.
- Let a client select a freelancer before escrow creation.
- Create deadline audit/reminder records as jobs are created or updated.

## Main Entry Points

- Convex: `createJob`, `selectFreelancer`, `getJob`, `listOpenJobs`, `listMarketplaceJobs`, `listJobsByClient`, `listJobsByFreelancer`.
- Frontend: `MarketplacePage`, `JobDetailPage`, `JobsPage`, `PostJobPage`.

## Data Model

`jobs` uses statuses `open`, `selected`, `funded`, `submitted`, `revision_requested`, `revision_submitted`, `completed`, `cancelled`, and `disputed`. `jobType` distinguishes `micro_gig` and `milestone_project`. `applications`, `milestones`, `workAgreements`, `escrows`, `workSubmissions`, and deadline records point back to the job.

## External Dependencies

Convex real-time queries, supported escrow asset configuration, wallet identity from the web app, and optional storage-backed attachments.

## Internal Dependencies

Applications, milestones, agreements, deadlines, revisions, escrows, reports, and wallet identity helpers.

## Important Flows

```text
client onboarding → createJob(open)
freelancer application → client selectFreelancer(selected)
agreement/escrow flow → funded → submitted/revision → completed/cancelled/disputed
```

## Common Change Locations

Change schema/status fields in `jobs/schema.ts`; validation and transitions in `jobs/helpers.ts`/`mutations.ts`; marketplace composition in `features/marketplace`; route metadata in `app/marketplace/jobs/[jobId]/page.tsx`.

## Risks / Gotchas

- Public mutations still trust caller-supplied wallet addresses in places; signed-session enforcement is a documented TODO.
- Job asset values must be supported configured Soroban token IDs, not arbitrary strings.
- `jobHash` is stored as a Convex string and source comments note conversion to on-chain `BytesN<32>` remains a TODO in job creation.

## Related Notes

[[modules/Applications and Milestones]], [[modules/Escrow and Payments]], [[modules/Work Agreements]], [[frontend/Routes and API]]
