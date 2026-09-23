---
type: reference
area: backend
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Domain Functions

The names below are the current Convex function surface found in the domain modules. Exact arguments and validators remain defined by source; use the module files before changing a call site.

| Domain | Main source | Representative functions | Notes |
| --- | --- | --- | --- |
| Jobs | `packages/backend/convex/jobs/` | `createJob`, `selectFreelancer`, `getJob`, `listOpenJobs`, `listMarketplaceJobs`, `listJobsByClient`, `listJobsByFreelancer` | Owns job lifecycle and client/freelancer association. |
| Applications | `packages/backend/convex/applications/` | `applyToJob`, `applyToMilestone`, application list queries | Application acceptance feeds milestone/job assignment. |
| Milestones | `packages/backend/convex/milestones/` | project/milestone creation, assign, continuation/replacement, escrow record creation/update | Handles ordered milestone projects and assignment gates. |
| Escrows | `packages/backend/convex/escrows/` | `createEscrowRecord`, `assignFreelancerToEscrow`, `updateEscrowStatus`, escrow queries | Convex mirror; Soroban is the value/state authority for on-chain escrow. |
| Agreements | `packages/backend/convex/work_agreements/` | create/send/accept/reject/confirm/lock/amend/reference/export event functions | Versioned agreement state and audit events. |
| Submissions | `packages/backend/convex/work_submissions/` | create draft, submit metadata, anchoring, anchor failure/retry, accept preview, cancel draft | Stores submission workflow and on-chain anchoring metadata. |
| Revisions | `packages/backend/convex/revisions/` | set policy, request, submit, accept, cancel | Links review changes to agreements/submissions. |
| Disputes | `packages/backend/convex/disputes/` | create, on-chain started/succeeded/failed, evidence/response/status/note, resolution records | Tracks review workflow and chain transaction phases. |
| Cancellations | `packages/backend/convex/cancellations/` | create, withdraw, respond, approve, on-chain phases, expire, notification | Separate cancellation request flow with audit events. |
| Collaboration | `packages/backend/convex/conversations/`, `attachments.ts` | conversation/message/read functions, attachment upload/access functions | Participant-scoped communication and file access metadata. |
| Deadlines | `packages/backend/convex/deadlines/` | deadline/reminder queries and `scanUpcomingDeadlines` | Scanner creates reminder/notification state; see [[backend/Sync and Scheduled Jobs]]. |
| Notifications | `packages/backend/convex/deadlines/` and `notifications` schema | reminder and notification mutations/queries | Notification types are schema-backed; delivery integrations are separate concerns. |
| Users/profiles | `packages/backend/convex/users/`, `profiles.ts` | user lookup/update/profile functions | Wallet-linked role/profile data; some mutation auth TODOs remain. |
| Reputation | `packages/backend/convex/reputation_records/`, `reputation.ts` | record/query reputation mirror functions | Mirrors confirmed on-chain completion data. |
| Transactions | `packages/backend/convex/transactions/`, `transactions.ts` | transaction record/create/update/query functions | Application audit records, not a historical chain index. |
| Admin | `packages/backend/convex/admin/`, `admin.ts` | metrics, dispute list/detail/status/note/resolve functions | Requires configured admin wallet and Convex secret. |
| Reports/waitlist | `reports.ts`, `reports/`, `waitlist/` | report creation/handling and waitlist functions | Reports still have an explicit signed-auth TODO. |

## Change guidance

1. Start at the domain schema and helper before changing a mutation.
2. Keep participant checks and status transitions in backend helpers, not only in UI guards.
3. When a chain transaction changes state, persist a phase/transaction record and use the existing sync mutation path where appropriate.
4. Update [[data/State Machines]] and the affected module note when a new status or transition is introduced.

## Authorization caveat

Current source contains explicit TODOs in jobs, applications, milestones, profiles, reports, and escrow helpers to replace trusted `walletAddress` inputs with signed wallet session/auth. Do not describe these paths as fully authenticated until those TODOs are removed and tested.
