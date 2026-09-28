---
type: reference
area: data
status: current
last_updated: 2026-09-26
source_of_truth: repository
---

# Convex Schema

The authoritative schema entry point is `packages/backend/convex/schema.ts`, which imports domain table definitions. Generated data-model/API files are derived outputs.

## Tables

| Table | Source | Role |
| --- | --- | --- |
| `users` | `users/schema.ts` | Wallet-linked identity, role, profile, onboarding, wallet type. |
| `jobs` | `jobs/schema.ts` | Job/micro-gig or milestone-project parent, budget, asset, lifecycle, deadlines, revisions. |
| `milestones` | `milestones/schema.ts` | Ordered project phases, assignment, escrow, deadline, continuation, and revision state. |
| `applications` | `applications/schema.ts` | Freelancer proposals for jobs/milestones. |
| `escrows` | `escrows/schema.ts` | Convex mirror of Soroban escrow plus transaction and sync metadata. |
| `workAgreements` | `work_agreements/schema.ts` | Current agreement aggregate and participant/term state. |
| `workAgreementVersions` | `work_agreements/schema.ts` | Versioned content, snapshot, hash, terms, acceptance, and lock fields. |
| `workAgreementEvents` | `work_agreements/schema.ts` | Agreement audit timeline. |
| `workSubmissions` | `work_submissions/schema.ts` | Proof metadata, attachments, revision relationship, anchor status. |
| `attachments` | `attachments/schema.ts` | Convex storage/external files, visibility, protection, parent links. |
| `attachmentAccessLogs` | `attachments/schema.ts` | Preview/download/access audit records. |
| `conversations` | `conversations/schema.ts` | Parent-linked threads and participants. |
| `messages` | `conversations/schema.ts` | User/system/event messages and attachment links. |
| `conversationReads` | `conversations/schema.ts` | Per-wallet read cursor/unread snapshot. |
| `deadlineReminders` | `deadlines/schema.ts` | Scheduled reminder queue and delivery status. |
| `notifications` | `deadlines/schema.ts` | Wallet-scoped workflow notification feed. |
| `deadlineAuditEvents` | `deadlines/schema.ts` | Deadline change history. |
| `revisionRequests` | `revisions/schema.ts` | Revision requests, counts, status, deadlines, and submission links. |
| `cancellationRequests` | `cancellations/schema.ts` | Participant cancellation request and on-chain status. |
| `cancellationEvents` | `cancellations/schema.ts` | Cancellation timeline. |
| `disputes` | `disputes/schema.ts` | Evidence, participant responses, review, settlement, and on-chain dispute state. |
| `disputeEvents` | `disputes/schema.ts` | Dispute timeline/moderation events. |
| `reputationRecords` | `reputation_records/schema.ts` | Convex mirror/display record for released escrow reputation. |
| `transactions` | `transactions/schema.ts` | Application transaction audit records, fee-path metadata, and optional Velo recovery identity/status (`gasRequestId`, inner/outer hashes, actual fee, reconciliation flag). Signed XDR is not stored. |
| `jobReports` | `reports/schema.ts` | Scam/off-platform/spam/fake-job reports. |
| `waitlistEntries` | `waitlist/schema.ts` | Normalized waitlist email and timestamps. |

## Common schema conventions

- Wallets are generally stored as normalized strings; wallet type is often optional for legacy-compatible records.
- Cross-domain links use Convex `v.id(...)` fields when the parent is a local table, and strings for on-chain IDs/parent IDs.
- Status fields use literal-union validators from `_shared/enum.ts` and domain schema files.
- `metadata` fields are intentionally flexible in several tables; validate security-sensitive values in helpers.
- Transaction hashes, explorer URLs, and sync metadata are optional because local workflow and chain confirmation can be separated.

## Change procedure

1. Read the domain schema and its helpers/mutations.
2. Check all indexes and existing callers.
3. Update `convex/schema.ts` only for new/renamed table exports.
4. Update generated Convex outputs through the repository’s normal tooling when required; do not hand-edit `_generated` files.
5. Update [[data/Domain Data Model]] and [[data/State Machines]] if relationships or lifecycle semantics change.
