# Highrable Implementation Inventory

Updated: 2026-05-21

This document inventories the functionality currently implemented in the Highrable codebase across the smart contracts, Convex backend, Next.js frontend, shared packages, and deployment/tooling layer. It is based on the code that exists in this repository today and calls out where a surface is complete, partial, placeholder, or still dependent on follow-up operational work.

## 1. Current Snapshot

Highrable is already implemented as a working three-layer product:

- Soroban smart contracts define the escrow lifecycle and on-chain reputation model.
- Convex stores product state, wallet-linked user data, job/application/escrow records, reputation mirrors, reports, disputes, cancellations, chat, deadlines, revisions, work agreements, work submissions, attachments, and transaction history.
- The Next.js web app exposes job posting, applications, escrow actions, wallet auth, passkey smart-account support, asset-aware escrow funding flows, dashboards, public profiles, proof pages, disputes, admin operations, and agreement review flows.

Current maturity by area:

| Area | Status | Notes |
| --- | --- | --- |
| Smart-contract escrow lifecycle | Implemented | Full core lifecycle, asset allowlist, open escrow creation, tests present |
| Reputation contract | Implemented | Completion recording, freelancer stats, tests present |
| Convex product model | Implemented | Jobs, milestones, applications, escrows, profiles, disputes, cancellations, agreements, submissions, attachments, chat, deadlines, revisions, transactions |
| External wallet UX | Implemented | Stellar Wallets Kit integration, persistence, auth challenge/verify |
| Passkey smart-account UX | Implemented with compatibility work | Create, restore, reconnect, discovered contract selection, smart-account escrow execution |
| Escrow asset support and top-up flows | Implemented | Supported escrow asset abstraction, optional XLM escrow, external-wallet XLM to USDC conversion flow |
| Marketplace and job detail UI | Implemented | Job creation, browsing, trust notices, applications, escrow actions, attachments, chat, agreements, proof links |
| Dashboard | Implemented | Client/freelancer modes, metrics, applied jobs, ongoing jobs, posted jobs |
| Disputes and cancellations workflows | Implemented | User-facing dispute and cancellation flows with evidence and on-chain status tracking |
| Admin operations | Implemented | Admin dashboard, dispute queue/detail, moderation notes, review status, and settlement recording APIs |
| Public profiles and proof pages | Implemented | Freelancer profile, client trust profile, escrow proof page |
| Talent directory | Placeholder | Planned surface, not yet a live directory |
| Automated scheduling | Partial | Deadline reminder scanning is scheduled; escrow/reputation sync remains action-driven |

## 2. Monorepo Structure

Primary implementation areas:

- `apps/web`: Next.js App Router frontend.
- `contracts/escrow`: Soroban escrow contract.
- `contracts/reputation`: Soroban reputation contract.
- `packages/backend/convex`: Convex schema, queries, mutations, actions, sync logic.
- `packages/convex-client`: typed client-facing Convex API re-export layer.
- `packages/ui`: shared UI component and provider package.
- `scripts`: testnet deployment and verification scripts.
- `deployments/testnet.json`: current recorded testnet deployment artifact.

## 3. Smart Contracts

### 3.1 Escrow Contract

Primary file: `contracts/escrow/src/lib.rs`

Implemented entrypoints:

- `initialize(reputation_contract_address, platform_admin)`
- `create_escrow(client, freelancer, asset, amount, job_hash)`
- `create_open_escrow(client, asset, amount, job_hash)`
- `create_and_fund_open_escrow(client, asset, amount, job_hash)`
- `fund_escrow(client, escrow_id)`
- `assign_freelancer(client, escrow_id, freelancer)`
- `submit_work(freelancer, escrow_id)`
- `approve_and_release(client, escrow_id, rating, review_hash)`
- `cancel_escrow(client, escrow_id)`
- `mark_disputed(actor, escrow_id)`
- `add_allowed_asset(platform_admin, asset)`
- `remove_allowed_asset(platform_admin, asset)`
- `is_allowed_asset(asset)`
- `get_allowed_asset_count()`
- `get_escrow(escrow_id)`
- `get_next_escrow_id()`
- `get_reputation_contract()`
- `get_platform_admin()`
- `is_initialized()`

Implemented behavior:

- Stores each escrow as a `TEscrow` record with `client`, optional `freelancer`, `asset`, `amount`, `job_hash`, status, and timestamps.
- Supports both direct escrows with a chosen freelancer and open escrows that can be assigned later.
- Supports create-and-fund in one operation for open escrows.
- Enforces auth per actor using Soroban `require_auth()`.
- Transfers token funds into the contract during funding and transfers funds to the freelancer on release.
- Calls the reputation contract from `approve_and_release()` so a released escrow also writes an immutable on-chain completion record.
- Maintains an optional asset allowlist controlled by the platform admin.
- Tracks instance TTL extension on each call.

Escrow status model:

- `Created`
- `Funded`
- `Submitted`
- `Released`
- `Cancelled`
- `Disputed`

Observed business rules:

- Client cannot also be the freelancer.
- `assign_freelancer` is only valid when the escrow has no freelancer yet and is still in `Created` or `Funded`.
- `submit_work` requires the assigned freelancer and a `Funded` escrow.
- `approve_and_release` is the payout path and also triggers reputation recording.
- `cancel_escrow` can return funds to the client when appropriate.
- `mark_disputed` moves the escrow into a terminal dispute state.

What is implemented well:

- Core escrow lifecycle is complete.
- Open-escrow workflow exists for freelancer selection after creation.
- Asset-token transfer behavior is built in and is driven by the escrow asset contract address passed into the contract.
- Cross-contract wiring to the reputation contract is already part of the release path.

Known limitations visible in contract code:

- No contract event emission for off-chain indexing.
- No built-in dispute resolution process beyond moving to `Disputed`.
- No escrow expiration/timeout mechanism.
- No contract-side metadata beyond the escrow structure and `job_hash`.

### 3.2 Escrow Contract Tests

Primary file: `contracts/escrow/src/test.rs`

Implemented coverage includes:

- Initialization and re-initialization guard.
- Standard escrow creation.
- Open escrow creation.
- Create-and-fund open escrow.
- Invalid amount rejection.
- Invalid freelancer rejection.
- Funding authorization and status checks.
- Open-escrow freelancer assignment.
- Submission flow.
- Release flow and reputation side effects.
- Cancellation behavior.
- Dispute behavior.
- Allowed asset add/remove and enforcement.
- Multiple escrows for the same parties with different milestone/job hashes.

### 3.3 Reputation Contract

Primary file: `contracts/reputation/src/lib.rs`

Implemented entrypoints:

- `initialize(authorized_escrow_contract)`
- `record_completion(escrow_id, client, freelancer, asset, amount, job_hash, rating, review_hash)`
- `get_completion(escrow_id)`
- `has_completion(escrow_id)`
- `get_freelancer_stats(freelancer)`
- `get_authorized_escrow_contract()`
- `is_initialized()`

Implemented behavior:

- Accepts completion writes only from the authorized escrow contract.
- Stores one immutable completion record per escrow.
- Tracks aggregate freelancer stats:
  - `completed_jobs_count`
  - `total_earned`
  - `total_rating`
  - derived `average_rating`
- Validates rating range and positive payment amounts.
- Uses persistent storage for completion history and aggregated freelancer stats.

### 3.4 Reputation Contract Tests

Primary file: `contracts/reputation/src/test.rs`

Implemented coverage includes:

- Initialization.
- Authorized vs unauthorized caller handling.
- Duplicate completion protection.
- Rating validation.
- Amount validation.
- Stats accumulation across multiple completions.
- Per-freelancer stat isolation.

## 4. Backend: Convex Implementation

Primary directory: `packages/backend/convex`

### 4.1 Core Tables

Implemented data model tables:

| Table | Purpose |
| --- | --- |
| `users` | Wallet-linked user record, role, wallet type, profile fields |
| `jobs` | Job postings, budget, asset, wallet ownership, job type, status |
| `milestones` | Multi-phase project decomposition and per-milestone lifecycle |
| `applications` | Freelancer proposals to jobs and milestones |
| `escrows` | Escrow mirror state, tx hashes, sync metadata |
| `workAgreements` | Agreement lifecycle records tied to jobs/milestones/escrows |
| `workAgreementVersions` | Immutable agreement version snapshots and hashes |
| `workAgreementEvents` | Agreement audit trail and workflow events |
| `workSubmissions` | Proof-of-work submissions, hashes, and on-chain anchoring metadata |
| `attachments` | File/link uploads with visibility and protection controls |
| `attachmentAccessLogs` | Attachment access audit logs |
| `conversations` | Parent-linked chat threads |
| `messages` | Thread messages and system events |
| `conversationReads` | Per-wallet read state and unread tracking |
| `deadlineReminders` | Scheduled deadline reminder queue |
| `notifications` | User notification feed for workflow events |
| `deadlineAuditEvents` | Deadline change audit history |
| `revisionRequests` | Revision workflow records and state |
| `cancellationRequests` | Cancellation workflow records and eligibility snapshots |
| `cancellationEvents` | Cancellation timeline events |
| `disputes` | Dispute records, evidence links, and settlement metadata |
| `disputeEvents` | Dispute timeline and moderation events |
| `reputationRecords` | Convex mirror of verified or created completion reviews |
| `jobReports` | Scam, spam, off-platform, fake job, and other reports |
| `transactions` | Wallet transaction audit trail with pending/success/failed status |

### 4.2 Shared Validation and Error Infrastructure

Primary files:

- `packages/backend/convex/_shared/input.ts`
- `packages/backend/convex/_shared/errors.ts`
- `packages/backend/convex/_shared/enum.ts`
- `packages/backend/convex/_shared/escrowAssets.ts`

Implemented backend conventions:

- Non-empty string validation.
- Positive/ranged number validation.
- Wallet normalization to uppercase.
- Typed Convex errors for bad request, not found, forbidden, and conflict flows.
- Enum validators for schema-safe statuses and action types.
- Supported escrow asset validation against the configured contract IDs exposed to the app and backend environment.

### 4.3 Jobs Domain

Primary files:

- `packages/backend/convex/jobs/mutations.ts`
- `packages/backend/convex/jobs/queries.ts`
- `packages/backend/convex/jobs/helpers.ts`
- `packages/backend/convex/jobs/scamSignals.ts`

Implemented functionality:

- `createJob` creates a micro-gig style job.
- `selectFreelancer` transitions a job from open to selected.
- `getJob`, `listOpenJobs`, `listMarketplaceJobs`, `listJobsByClient`, and `listJobsByFreelancer` expose job data to the app.
- Job creation sanitizes title, description, budget, asset, wallet, and fallback job hash.
- Scam-signal detection blocks disallowed job posts that ask for seed phrases, private keys, or similar high-risk behavior.

Implemented job model behavior:

- Supports both `micro_gig` and `milestone_project` job types.
- Restricts job asset selection to supported configured escrow asset contract IDs rather than accepting arbitrary contract IDs.
- Tracks job lifecycle values such as `open`, `selected`, `funded`, `submitted`, `completed`, `cancelled`, and `disputed`.
- `listMarketplaceJobs` merges marketplace jobs with escrow context for trust/safety-aware UI rendering.

### 4.4 Applications Domain

Primary files:

- `packages/backend/convex/applications/mutations.ts`
- `packages/backend/convex/applications/queries.ts`
- `packages/backend/convex/applications/helpers.ts`

Implemented functionality:

- `applyToJob` stores a freelancer proposal for a job.
- `applyToMilestone` stores a freelancer proposal for a milestone.
- `listApplicationsByJob`, `listApplicationsByMilestone`, and `listApplicationsByFreelancer` support marketplace and dashboard views.
- Duplicate application prevention exists.
- Client self-application is blocked.
- Application eligibility is computed from job or milestone lifecycle state.

### 4.5 Escrows Domain

Primary files:

- `packages/backend/convex/escrows/mutations.ts`
- `packages/backend/convex/escrows/queries.ts`
- `packages/backend/convex/escrows/helpers.ts`

Implemented functionality:

- `createEscrowRecord` creates a Convex escrow record for micro-gig jobs.
- `assignFreelancerToEscrow` attaches a freelancer to an existing open escrow record.
- `updateEscrowStatus` updates status plus the relevant tx hash field for create/fund/submit/release/cancel/dispute operations.
- `getEscrowByEscrowId`, `getEscrowByJobId`, `getEscrowByMilestoneId`, and `listEscrowsByWallet` power detail pages and dashboards.
- `getClientTrustStats` aggregates funded/completed/disputed history for client trust surfaces.

Implemented metadata and safety behavior:

- Escrows store per-operation tx hashes.
- Escrows store sync metadata fields such as `lastSyncAt`, `lastSyncOutcome`, `lastSyncedOnChainStatus`, and `lastSyncErrorMessage`.
- Escrow assets are sanitized against the configured supported escrow asset set before records are written.
- Escrow status maps into job status progression.
- Duplicate escrow creation for the same micro-gig job is blocked.

### 4.6 Milestones Domain

Primary files:

- `packages/backend/convex/milestones/mutations.ts`
- `packages/backend/convex/milestones/queries.ts`
- `packages/backend/convex/milestones/helpers.ts`

Implemented functionality:

- `createMilestoneProject` creates a milestone-backed job plus all milestone rows.
- `addMilestoneToProject` appends milestones to a project.
- `updateMilestone` edits a milestone before escrow creation.
- `assignFreelancerToMilestone` assigns a freelancer to a specific milestone.
- `offerMilestoneContinuation` offers the next milestone to the previous freelancer.
- `respondToMilestoneContinuation` accepts or rejects continuation.
- `openMilestoneForReplacement` re-opens milestone applications.
- `assignFreelancerToMultipleMilestones` bulk-assigns the same freelancer.
- `createMilestoneEscrowRecord` creates a milestone-linked escrow mirror.
- `updateMilestoneEscrowStatus` advances milestone escrow state and patches the linked escrow row.
- `listMilestonesByJob`, `getMilestone`, `listMilestonesByFreelancer`, and `getMilestoneProjectSummary` support UI rendering.

Implemented milestone behavior:

- Milestones have an order and their own lifecycle.
- Milestone asset values are validated against the supported escrow asset set.
- Later milestones can remain locked until prior work is released.
- Continuation offers are tracked explicitly.
- Parent job status is recalculated from milestone states.

This is one of the more advanced parts of the backend and is broader than the currently polished frontend experience.

### 4.7 Users and Profiles Domain

Primary files:

- `packages/backend/convex/users/mutations.ts`
- `packages/backend/convex/users/queries.ts`
- `packages/backend/convex/users/helpers.ts`
- `packages/backend/convex/profiles.ts`

Implemented functionality:

- `upsertUser` creates or updates a user by wallet.
- `recordWalletIdentity` records wallet type such as `external_wallet` or `passkey_smart_account`.
- `getUserByWallet` and `listUsersByRole` expose user data.
- `updateFreelancerProfile` stores name, bio, skills, location, portfolio links, GitHub, and website.
- `updateClientProfile` stores name, company name, bio, location, and external links.
- `getFreelancerProfile` builds the public freelancer profile response.
- `getClientTrustProfile` builds the public client trust profile response.

Implemented validation behavior:

- Wallet normalization is enforced.
- URL validation is applied to public links.
- Skills are capped and deduplicated.
- Wallet type is retained so profiles can represent classic wallets vs passkey smart accounts.

### 4.8 Dashboard Domain

Primary file: `packages/backend/convex/dashboard/queries.ts`

Implemented functionality:

- `getFreelancerIncomeSummary` returns:
  - total earned by asset
  - pending escrow by asset
  - completed jobs count
  - active jobs count
  - awaiting funding count
  - recent payouts
- `listFreelancerAppliedJobsPage` builds a freelancer applications view with derived statuses.
- `listFreelancerOngoingJobsPage` returns active engagement rows.
- `listClientPostedJobsPage` returns the client-side posted jobs view.

### 4.9 Reports Domain

Primary files:

- `packages/backend/convex/reports.ts`
- `packages/backend/convex/reports/schema.ts`

Implemented functionality:

- `reportJob` creates a job report.
- Reports can be anonymous or wallet-linked.
- Duplicate reports from the same wallet for the same job are blocked.
- `getJobReportCount` and `listReportsByJob` support trust and moderation UI.

### 4.10 Reputation Records Domain

Primary files:

- `packages/backend/convex/reputation_records/mutations.ts`
- `packages/backend/convex/reputation_records/queries.ts`
- `packages/backend/convex/reputation_records/helpers.ts`

Implemented functionality:

- `createReputationRecord` creates a release-backed review record when allowed.
- `listReputationByFreelancer` powers profile reputation surfaces.
- `getReputationByEscrowId` links review data to an escrow.
- `getVerifiedReviewForJob` and `getVerifiedReviewForMilestone` build proof/review surfaces.

Implemented validation behavior:

- Ratings are constrained to 1 through 5.
- Reputation records require a released escrow.
- Wallets, job IDs, and milestone IDs are cross-checked against the escrow.

### 4.11 Proofs Domain

Primary file: `packages/backend/convex/proofs.ts`

Implemented functionality:

- `getEscrowProof` returns the data needed to render the public escrow proof page.
- Proof payload can include:
  - escrow details
  - linked job
  - linked milestone
  - linked reputation record
  - summarized client profile
  - summarized freelancer profile
  - transaction proof list derived from stored tx hashes

### 4.12 Transactions Domain

Primary files:

- `packages/backend/convex/transactions/mutations.ts`
- `packages/backend/convex/transactions/queries.ts`

Implemented functionality:

- `createTransaction` creates an audit record for a wallet action.
- `updateTransactionStatus` moves a transaction to `success` or `failed`.
- `listTransactionsByWallet` exposes history.
- `getTransactionByHash` looks up a transaction.
- Client request IDs are supported alongside tx hashes for request tracking and post-submit reconciliation.

### 4.13 Sync and On-chain Read Domain

Primary files:

- `packages/backend/convex/sync.ts`
- `packages/backend/convex/syncMutations.ts`
- `packages/backend/convex/lib/stellarReads.ts`

Implemented functionality:

- `syncEscrowStatus` reads on-chain escrow state and updates Convex if the state advanced safely.
- `syncReputationRecord` reads on-chain completion data and creates a mirrored reputation record when needed.
- Internal mutations apply sync results or capture sync failures.
- Status progression checks prevent unsafe local downgrades.

Operational implication:

- Convex acts as a fast mirror of on-chain escrow and reputation state, but sync still depends on explicit action calls or external orchestration.

### 4.14 Attachments Domain

Primary files:

- `packages/backend/convex/attachments/mutations.ts`
- `packages/backend/convex/attachments/queries.ts`
- `packages/backend/convex/attachments/schema.ts`
- `packages/backend/convex/attachments/helpers.ts`

Implemented functionality:

- Upload URL issuance and persisted attachment records.
- External attachment support (links/video links/docs).
- Parent attachment operations for jobs, revisions, disputes, cancellations, work submissions, and chat.
- Protection modes (`standard`, `protected_preview`, `download_restricted`).
- Visibility controls (`private`, `participants`, `public`, `admin_only`).
- Access policy evaluation and role-based preview/download checks.
- Access logging for preview/download attempts and deterrent events.

### 4.15 Conversations and Chat Domain

Primary files:

- `packages/backend/convex/conversations/mutations.ts`
- `packages/backend/convex/conversations/queries.ts`
- `packages/backend/convex/conversations/schema.ts`
- `packages/backend/convex/conversations/helpers.ts`

Implemented functionality:

- Parent-scoped threads for job, milestone, escrow, dispute, and submission contexts.
- Participant-aware message send/read flows.
- Attachment-aware chat messages.
- System/event messages for lifecycle events (proof, deadlines, disputes, cancellations, agreements).
- Conversation preview and unread-count support.

### 4.16 Deadlines and Notifications Domain

Primary files:

- `packages/backend/convex/deadlines/mutations.ts`
- `packages/backend/convex/deadlines/queries.ts`
- `packages/backend/convex/deadlines/schema.ts`
- `packages/backend/convex/deadlines/helpers.ts`
- `packages/backend/convex/crons.ts`

Implemented functionality:

- Job/milestone deadline assignment and updates with audit events.
- Reminder scheduling and lifecycle tracking (`pending`, `sent`, `skipped`, `failed`).
- Notification records for deadlines, revisions, disputes, cancellations, and agreement events.
- Cron-based reminder scanning (`scanUpcomingDeadlines`) every 15 minutes.
- Overdue detection and unread notification counters.

### 4.17 Revisions Domain

Primary files:

- `packages/backend/convex/revisions/mutations.ts`
- `packages/backend/convex/revisions/queries.ts`
- `packages/backend/convex/revisions/schema.ts`
- `packages/backend/convex/revisions/helpers.ts`

Implemented functionality:

- Revision policy configuration (`none`, `fixed`, `unlimited`) on micro-gig/milestone parents.
- Revision request creation with reason, requested changes, optional evidence, and deadlines.
- Revision status transitions (`requested`, `acknowledged`, `revision_submitted`, `accepted`, etc.).
- Parent context patching and timeline helpers used by submission/dispute/cancellation flows.

### 4.18 Work Agreements Domain

Primary files:

- `packages/backend/convex/work_agreements/mutations.ts`
- `packages/backend/convex/work_agreements/queries.ts`
- `packages/backend/convex/work_agreements/schema.ts`
- `packages/backend/convex/work_agreements/helpers.ts`

Implemented functionality:

- Draft creation for both `client_uploaded` and `highrable_generated` agreement types.
- Agreement readiness/send/accept/reject/cancel/lock flows.
- Versioning with immutable snapshots and event logs.
- Agreement hash fields and version-level context for proof/revision/dispute/cancellation workflows.
- Amendment proposal/accept/reject flow and supersede behavior.

### 4.19 Work Submissions Domain

Primary files:

- `packages/backend/convex/work_submissions/mutations.ts`
- `packages/backend/convex/work_submissions/queries.ts`
- `packages/backend/convex/work_submissions/schema.ts`
- `packages/backend/convex/work_submissions/helpers.ts`

Implemented functionality:

- Draft proof submission records linked to escrow/job/milestone contexts.
- Proof metadata submission with normalized manifest and hash fields.
- Submission states for review and anchoring (`submitted_for_review`, `accepted_for_final`, `anchoring`, `anchored`, `anchor_failed`).
- Revision-linked submission handling.
- Protective attachment patching for freelancer deliverables before payout.

### 4.20 Cancellations Domain

Primary files:

- `packages/backend/convex/cancellations/mutations.ts`
- `packages/backend/convex/cancellations/queries.ts`
- `packages/backend/convex/cancellations/schema.ts`
- `packages/backend/convex/cancellations/helpers.ts`

Implemented functionality:

- Cancellation request creation with eligibility snapshots and reason categories.
- Freelancer response flow (accept/reject) plus evidence attachment support.
- On-chain cancellation lifecycle tracking (`started`, `succeeded`, `failed`) with transaction metadata.
- Expiration and withdrawal flows for pending requests.
- Parent job/milestone/escrow status reconciliation after cancellation outcomes.

### 4.21 Disputes Domain

Primary files:

- `packages/backend/convex/disputes/mutations.ts`
- `packages/backend/convex/disputes/queries.ts`
- `packages/backend/convex/disputes/schema.ts`
- `packages/backend/convex/disputes/helpers.ts`

Implemented functionality:

- Dispute creation with reason categories and attachment-backed evidence.
- Timeline/event model for responses, status changes, and moderation notes.
- On-chain dispute marking state tracking (`not_marked`, `marking`, `marked`, `mark_failed`).
- Participant access controls and contextual agreement/proof linking.

### 4.22 Admin Operations Domain

Primary files:

- `packages/backend/convex/admin/queries.ts`
- `packages/backend/convex/admin/mutations.ts`
- `packages/backend/convex/admin/helpers.ts`

Implemented functionality:

- Admin metrics aggregation across users, jobs, escrows, disputes, submissions, revisions, and reminders.
- Admin dispute queue and detail retrieval.
- Moderator note and review-status update workflows.
- Settlement flow tracking for dispute resolutions, including split-resolution percentages and escrow/parent status reconciliation after successful resolution.

### 4.23 Important Backend Gaps and TODOs

Visible in current code:

- Several mutations still rely on trusting the provided wallet address and explicitly note that signed wallet session/auth should replace this later.
- Agreement source-file content hash capture is still a TODO in the work agreement helper path.
- Work-submission attachment file checksum capture is still a TODO in client-side proof hash preparation.
- Escrow/reputation sync is action-driven rather than fully automated by a scheduler inside this repo.
- Transaction history sync from chain is still lighter than the product data mirror.

## 5. Frontend: Next.js Web App

Primary directory: `apps/web`

### 5.1 App Routes

Implemented routes:

| Route | Purpose | Current status |
| --- | --- | --- |
| `/` | Main landing page | Implemented |
| `/home` | Alternate landing route | Implemented |
| `/marketplace` | Main marketplace workflow | Implemented |
| `/jobs` | Job browsing page | Implemented |
| `/marketplace/jobs/[jobId]` | Job detail and execution flow | Implemented |
| `/post-job` | Standalone job posting page | Implemented |
| `/dashboard` | Client/freelancer dashboard | Implemented |
| `/freelancers/[walletAddress]` | Public freelancer profile | Implemented |
| `/clients/[walletAddress]` | Public client trust profile | Implemented |
| `/proof/[escrowId]` | Public escrow proof page | Implemented |
| `/disputes` | Wallet-scoped dispute list | Implemented |
| `/disputes/[disputeId]` | Dispute detail timeline and response flow | Implemented |
| `/work-agreements/[agreementId]/review` | Freelancer agreement review/accept/reject flow | Implemented |
| `/admin` | Admin operations dashboard | Implemented |
| `/admin/disputes` | Admin dispute console | Implemented |
| `/admin/disputes/[disputeId]` | Admin dispute detail and settlement actions | Implemented |
| `/talent` | Planned talent directory preview | Placeholder |
| `/api/admin/metrics` | Admin metrics endpoint | Implemented |
| `/api/admin/disputes` | Admin dispute list endpoint | Implemented |
| `/api/admin/disputes/[disputeId]` | Admin dispute detail endpoint | Implemented |
| `/api/admin/disputes/[disputeId]/status` | Admin review-status update endpoint | Implemented |
| `/api/admin/disputes/[disputeId]/note` | Admin moderation-note endpoint | Implemented |
| `/api/admin/disputes/[disputeId]/resolve` | Admin dispute settlement endpoint | Implemented |
| `/api/auth/stellar/challenge` | Challenge issue endpoint | Implemented |
| `/api/auth/stellar/verify` | Signature verify and session issue endpoint | Implemented |

### 5.2 Landing, Layout, and SEO

Primary files:

- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/home/page.tsx`
- `apps/web/app/robots.ts`
- `apps/web/app/sitemap.ts`
- `apps/web/core/seo/*`
- `apps/web/features/landing-v2/*`

Implemented functionality:

- Marketing landing page with multiple sections and structured metadata.
- Central metadata helpers and route SEO config.
- Generated robots and sitemap routes.
- Shared product page hero/layout patterns.

### 5.3 Wallet Connection, Auth, and Session Layer

Primary files:

- `apps/web/core/wallet/context/wallet-context.tsx`
- `apps/web/core/wallet/hooks/use-wallet.ts`
- `apps/web/core/wallet/hooks/use-highrable-wallet-identity.ts`
- `apps/web/core/wallet/components/*`
- `apps/web/core/wallet/clients/stellar-wallet-kit-client.ts`
- `apps/web/core/wallet/services/wallet-persistence-service.ts`
- `apps/web/app/api/auth/stellar/challenge/route.ts`
- `apps/web/app/api/auth/stellar/verify/route.ts`
- `apps/web/core/wallet/server/auth-store.ts`
- `apps/web/core/wallet/server/signature.ts`

Implemented functionality:

- External wallet connection through Stellar Wallets Kit.
- Persisted wallet restore across refreshes.
- Wallet capability/status surfaces such as connected address, testnet status, funding state, and contract-write readiness.
- Unified wallet identity abstraction that resolves either:
  - external wallet address
  - passkey smart-account contract address
- Challenge-response auth flow for Stellar addresses.
- HTTP-only signed session cookie issuance on successful verification.

### 5.4 Passkey Smart Accounts

Primary files:

- `apps/web/core/wallet/passkey-smart-account-context.tsx`
- `apps/web/core/stellar/smart-account-kit.ts`
- `apps/web/core/stellar/passkeySmartAccountExecutor.ts`
- `apps/web/core/stellar/smart-account-config.ts`
- `apps/web/core/passkeys/*`
- `docs/passkey-escrow-debug-progress.md`
- `docs/passkey-smart-account-implementation.md`

Implemented functionality:

- Browser WebAuthn capability detection.
- Smart-account config validation and compatibility checks.
- Passkey smart-account creation.
- Silent restore of stored passkey sessions.
- Reconnect flow using authenticated credential discovery.
- Discovered contract picker state for passkeys that map to multiple smart accounts.
- Local session clearing and SDK reset behavior.
- Unified active wallet mode switching between external wallet and passkey smart account.
- Passkey-aware escrow execution path via a dedicated smart-account executor.

Documented recent progress already tracked in the repo:

- Smart-account config normalization and compatibility guards.
- IndexedDB/localStorage resilience for passkey session recovery.
- Runtime on-chain WASM hash verification.
- Compatibility fallback for legacy context-rule ABI differences.
- Auth payload signing and argument coercion workarounds for `smart-account-kit` / bindings compatibility.
- Passkey escrow creation flow brought to end-to-end working status in the app according to the debug report.

### 5.5 Payment Assets and Stellar Integration Layer

Primary files:

- `apps/web/core/stellar/escrow-contract.ts`
- `apps/web/core/stellar/transaction.ts`
- `apps/web/core/stellar/transactionExecutor.ts`
- `apps/web/core/stellar/amounts.ts`
- `apps/web/core/stellar/assets.ts`
- `apps/web/core/stellar/payment-assets.ts`
- `apps/web/core/stellar/path-payments.ts`
- `apps/web/core/stellar/stablecoin-config.ts`
- `apps/web/core/stellar/trustline.ts`
- `apps/web/core/stellar/smart-account-balances.ts`
- `apps/web/core/stellar/components/xlm-to-usdc-top-up-panel.tsx`
- `apps/web/core/stellar/components/*`
- `apps/web/core/stellar/hooks/*`

Implemented functionality:

- Stablecoin config validation from environment.
- Supported escrow asset abstraction with:
  - a primary stablecoin escrow asset
  - an optional native XLM escrow asset when configured
- Human amount parsing and token-unit conversion for asset-specific decimals.
- On-chain escrow asset balance reads for both classic wallets and passkey smart accounts.
- Trustline/onboarding readiness helpers.
- Generic escrow-balance readiness checks that work across supported payment assets.
- External-wallet and passkey-specific contract execution routing.
- Horizon-based XLM to USDC quoting and execution using strict-receive path payments for external wallets.
- Path-payment error classification for trustline missing, no route, insufficient XLM, route changes, network mismatch, timeout, and wallet rejection cases.
- Explorer and transaction utility helpers.
- UI components for escrow balances, onboarding, and funding top-up.

### 5.6 Marketplace and Job Browsing

Primary files:

- `apps/web/features/marketplace/marketplace-page.tsx`
- `apps/web/features/jobs/jobs-page.tsx`
- `apps/web/features/marketplace/components/*`
- `apps/web/features/jobs/components/*`
- `apps/web/features/marketplace/lib/*`

Implemented functionality:

- Active marketplace feed backed by Convex.
- Separate jobs page for browsing/search/sort/filter flows.
- Safety-aware sorting and filtering using job and escrow state.
- Verified-funded vs all-active filtering.
- Trust/safety notice rendering for freelancers.
- Job cards surface the selected escrow asset and show volatility warnings for native XLM escrow jobs.
- Job application dialog and proposal submission.
- Wallet-aware prevention of applying to your own job.

### 5.7 Job Posting

Primary files:

- `apps/web/features/post-job/post-job-page.tsx`
- `apps/web/features/marketplace/components/create-job-form.tsx`

Implemented functionality:

- Job creation form with validation and sanitization.
- Support for both job modes:
  - `micro_gig`
  - `milestone_project`
- Scam-signal analysis before submission.
- Payment asset selection and validation across supported escrow assets.
- Recommended stablecoin selection plus advanced native XLM escrow selection when that asset is configured.
- Milestone builder for milestone projects.
- Optional immediate open-escrow creation and funding for micro-gigs when using an eligible external wallet and a supported asset.
- Transaction record creation and status updates during pre-funded escrow creation.

Important current UX behavior:

- Passkey smart-account users can create jobs but are explicitly asked to create/fund escrow later from the escrow action panel instead of pre-funding during creation.

### 5.8 Job Detail and Escrow Execution Flow

Primary files:

- `apps/web/features/marketplace/components/job-detail.tsx`
- `apps/web/features/marketplace/components/escrow-action-panel.tsx`
- `apps/web/features/marketplace/components/applications-list.tsx`
- `apps/web/features/marketplace/components/milestone-card.tsx`
- `apps/web/features/marketplace/hooks/use-escrow-actions.ts`
- `apps/web/features/marketplace/hooks/use-milestone-escrow-actions.ts`
- `apps/web/features/marketplace/hooks/use-sync-actions.ts`

Implemented functionality:

- Job detail page renders:
  - job metadata
  - work mode
  - budget and asset
  - client and freelancer links
  - scam warnings
  - trust and safety notices
  - client trust summary
  - job reports entry point
  - proof link when an escrow exists
- Application list is shown for client selection flows.
- Escrow action panel supports the lifecycle for non-milestone jobs.
- Escrow and milestone action panels use asset-aware readiness checks and balance panels before funding.
- XLM escrow jobs show volatility warnings in funding and review surfaces.
- External-wallet users with insufficient USDC can use an embedded XLM to USDC top-up flow before funding supported stablecoin escrows.
- Sync status panel supports manual escrow sync from Stellar.
- Verified completion card appears when release/reputation data exists.
- Proof sync prompt appears when release exists but review data is not mirrored yet.
- Milestone projects show milestone progress counts and milestone cards.

### 5.9 Dashboard

Primary files:

- `apps/web/features/dashboard/dashboard-page.tsx`
- `apps/web/features/dashboard/components/*`
- `apps/web/features/dashboard/hooks/*`

Implemented functionality:

- Dashboard requires a connected wallet.
- Mode switch between freelancer and client views.
- Mode persistence logic.
- Freelancer metrics:
  - total earned by asset
  - pending escrow
  - completed jobs
  - active jobs
  - awaiting funding
  - recent payouts
- Freelancer supporting sections:
  - applied jobs
  - ongoing jobs
- Client supporting section:
  - posted jobs
- Quick actions linking back to marketplace and post-job flows.

### 5.10 Public Profiles and Trust Surfaces

Primary files:

- `apps/web/features/profile/*`
- `apps/web/features/client-profile/*`

Implemented freelancer-profile functionality:

- Public freelancer profile page.
- Header, stats cards, recent contracts, and verified reviews.
- Owner-editable freelancer profile form.
- Reputation explanation UI tying reviews back to escrow-backed completion.

Implemented client-profile functionality:

- Public client trust profile page.
- Trust stats cards.
- Recent jobs, funded escrows, and completed payments sections.
- Reported-jobs summary card.
- Work breakdown by asset/payment history.
- Owner-editable client profile form.

### 5.11 Escrow Proof Pages

Primary files:

- `apps/web/features/proof/escrow-proof-page.tsx`
- `apps/web/features/proof/components/*`

Implemented functionality:

- Public proof page for an escrow ID.
- Proof header, participants, timeline, payment, work details, and reputation sections.
- Share actions.
- Manual sync buttons for escrow status and reputation record reconciliation.
- Graceful loading and not-found handling.

Known product note:

- Proof surfaces are implemented, but there is still a TODO in the proof explanation UI to add privacy controls before production.

### 5.12 Talent Surface

Primary file: `apps/web/features/talent/talent-page.tsx`

Current state:

- This page is intentionally a preview/placeholder.
- It explains the planned future talent directory.
- It shows mock profile cards and planned trust signals.
- It currently routes users toward posting jobs or browsing jobs instead of offering a live searchable directory.

### 5.13 Collaboration, Delivery, and Operations Surfaces

Primary files:

- `apps/web/features/work-agreements/components.tsx`
- `apps/web/features/work-submissions/components/work-proof-submission-panel.tsx`
- `apps/web/features/chat/components/conversation-thread.tsx`
- `apps/web/features/attachments/components.tsx`
- `apps/web/features/attachments/protected-viewer.tsx`
- `apps/web/features/deadlines/notifications-panel.tsx`
- `apps/web/features/cancellations/components/*`
- `apps/web/features/disputes/components/*`
- `apps/web/features/admin/*`

Implemented functionality:

- Work agreement setup, generation/upload paths, review, acceptance/rejection, and amendment flow surfaces.
- Work proof submission UX for draft, preview, revision-aware updates, and on-chain anchor state transitions.
- Parent-scoped chat threads (job/escrow) with message attachments and system event context.
- Protected attachment previews with watermark overlays, deterrent logging, and role-aware download restrictions.
- Deadline notification panel in dashboard with unread counts and reminder visibility.
- Cancellation request/respond/execute flows with status badges and timeline panels.
- Dispute opening, evidence upload, response composition, and timeline views.
- Admin dashboard and dispute review/resolution console tied to admin API endpoints.

Current scope note:

- Most collaboration and operations UIs are embedded in marketplace/job-detail/dashboard/admin flows rather than exposed as separate top-level navigation routes.

## 6. Shared Packages and Internal Infrastructure

### 6.1 `@repo/convex-client`

Primary package: `packages/convex-client`

Implemented role:

- Shared typed Convex client export used by the web app.
- Centralizes access to backend-generated Convex API bindings from frontend code.

### 6.2 `@repo/ui`

Primary package: `packages/ui`

Implemented role:

- Shared UI component library and UI providers.
- Exposes reusable components, hooks, styles, theme support, and email exports.
- Used by the web app for buttons, alerts, inputs, textareas, dialogs, and other reusable primitives.

## 7. Tooling, Scripts, and Operational Assets

### 7.1 Testnet Deployment Scripts

Primary files:

- `scripts/deploy-testnet.sh`
- `scripts/verify-testnet.sh`
- `scripts/print-mainnet-env.ts`
- `scripts/verify-smart-account-mainnet.ts`

Implemented functionality:

- Builds both contracts.
- Resolves contract wasm outputs.
- Deploys both contracts to Stellar testnet.
- Initializes escrow and reputation contracts with correct cross-contract wiring.
- Verifies deployed wiring.
- Writes a deployment artifact.
- Prints required frontend and backend environment variables.
- Includes operational helpers for mainnet configuration introspection and smart-account readiness verification.

### 7.2 Current Recorded Testnet Deployment

Primary file: `deployments/testnet.json`

Current recorded artifact:

- Network: `testnet`
- RPC URL: `https://soroban-testnet.stellar.org`
- Horizon URL: `https://horizon-testnet.stellar.org`
- Reputation contract ID: `CAX47AOKL65R5QJGZJPV5GUZ4FJ4V6WMMIA2NFA3MV4JSUM3T37IHVDQ`
- Escrow contract ID: `CC7VC52CA5QTPDIUQORTDIHMDIUTROTLNWEIY7XV4SFKAB75T4WGGCKO`
- Platform admin / deployer address: `GDIXHECIHT6KCWFT7K4H2NIEZCILGAUTE6IXSHPJ6EYCUWMXK6AURV2M`
- Deployer identity: `burner-key`
- Deployed at: `2026-05-19T16:05:44Z`

## 8. Implementation Progress Summary

### 8.1 What Is Already Implemented End-to-End

- Escrow lifecycle on Soroban from creation through release/cancel/dispute.
- Reputation recording on release and freelancer stat aggregation.
- Job posting, applications, freelancer selection, and escrow mirror records in Convex.
- Work agreement lifecycle with versioning, review, and lock flows.
- Work submission lifecycle with proof hashes, revision-aware states, and on-chain anchoring status.
- Attachment upload and protected-preview policies with access logging.
- Parent-context chat threads with event-aware messaging.
- Deadline reminders/notifications with cron-driven reminder scans.
- Cancellation workflows with participant responses and on-chain cancel status tracking.
- Dispute workflows with evidence, timeline, on-chain marking states, and admin review interfaces.
- Admin metrics and dispute operations APIs gated by configured admin wallet plus session checks.
- Marketplace browsing with trust and safety signals.
- Public client and freelancer profiles.
- Public escrow proof pages and manual sync actions.
- Dashboard views for both freelancers and clients.
- External wallet auth and transaction signing.
- Passkey smart-account creation, restore, reconnect, and escrow execution support.
- Asset-aware escrow payment flow, including supported native XLM jobs and external-wallet XLM to USDC top-up tooling.

### 8.2 Areas That Are Implemented but Not Fully Mature

- Milestone support is broad in the backend and present in the UI, but the micro-gig flow is clearly the most polished path today.
- XLM to USDC top-up is implemented, but it currently depends on an external wallet, a valid USDC trustline, and available Stellar DEX liquidity at quote/submit time.
- Passkey support is implemented and recently hardened, but it still includes compatibility code tied to the current `smart-account-kit` and deployed smart-account ABI behavior.
- Escrow/reputation sync exists, but it remains action-driven rather than fully automated indexing.
- Agreement source-file hashing and submission attachment file checksums are not fully wired yet.
- Backend mutation auth still contains wallet-trust TODOs that should be replaced with signed-session enforcement.

### 8.3 Known Placeholder or Follow-up Surfaces

- Talent directory is not yet a live directory.
- Proof privacy controls are still a follow-up item.
- Smart contracts do not emit events for richer indexing.
- Transaction history sync from chain is still a follow-up scope.

## 9. Bottom Line

Highrable is not just a scaffold. The repository already contains a substantial MVP-to-early-product implementation with:

- real Soroban escrow and reputation contracts,
- a meaningful Convex product model,
- a routed Next.js product UI,
- external-wallet and passkey smart-account support,
- public proof and profile surfaces,
- and working deployment/verification tooling.

The clearest remaining gaps are around production hardening rather than missing foundations: stronger backend auth guarantees, agreement/proof file integrity hashing completion, sync/indexing automation, proof privacy controls, contract event ergonomics, and finishing placeholder discovery surfaces such as talent search.