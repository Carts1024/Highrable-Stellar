---
type: module
area: admin
status: current
last_updated: 2026-09-29
source_of_truth: repository
---

# Admin Operations

## Purpose

Give the configured platform owner access to platform metrics and owner controls, with a separately managed team of external-wallet dispute admins for case review and settlement.

## Current Status

Admin dashboard, owner-managed dispute-admin membership, case assignment, and dispute settlement recovery are implemented in source. The current recorded contract deployments predate dispute-admin membership; the new contract behavior is undeployed and requires a fresh isolated deployment. The platform owner remains `HIGHRABLE_ADMIN_WALLET_ADDRESS`; external dispute admins are stored separately from `users.role` and scoped to the configured Stellar network and escrow contract. C06 freezes the shared frontend dispute contract in `docs/instawards/C06-Frontend-Handoff.md`. This is platform-operated review, not decentralized arbitration.

## Primary Locations

- Frontend: `apps/web/features/admin/`, `apps/web/app/admin/`
- Next auth/API: `apps/web/core/admin/`, `apps/web/app/api/admin/`
- Convex: `packages/backend/convex/admin/`
- Shared admin checks: `packages/backend/convex/_shared/adminAuth.ts`

## Responsibilities

- Aggregate bounded metrics across users/jobs/escrows/disputes/submissions/revisions/reminders.
- List and inspect disputes with filters.
- Add moderator notes and move review status.
- Track settlement started/succeeded/failed with bps, payout/refund amounts, note, tx hash, and parent terminal-state patches.

## Main Entry Points

Routes: `/admin`, `/admin/admins`, `/admin/disputes`, `/admin/disputes/[disputeId]`; APIs cover metrics, capability/session checks, membership operations/recovery, queue/detail, claim/assignment, notes/status, and settlement recovery. Convex functions include `getAdminDashboardMetrics`, `getAdminCapabilities`, `listDisputeAdmins`, `claimDispute`, `assignDispute`, `addModeratorNote`, `changeDisputeReviewStatus`, and settlement/membership operation mutations.

## Data Model

Admin data is stored on disputes/events, scoped disputeAdmins and disputeAdminOperations, assignment audit events, settlement attempts, escrows, parent jobs/milestones, and transactions. Cases start unassigned. Admin identity comes from a verified signed wallet session; Convex independently checks the server secret and owner or active scoped membership.

## External Dependencies

Signed external-wallet session cookie, owner/secret/network/contract environment configuration, Convex HTTP client, escrow membership/settlement methods, Soroban RPC reconciliation, and explorer URL metadata.

The dispute pages use an identity-scoped TanStack Query access gate. Queue/detail reads stay unmounted until the server-verified wallet matches the active external wallet; passkey mode is instructed to switch to the external admin wallet. Protected query cache is cancelled/removed on wallet changes, disconnects, and API 401/403 responses. Queue workload metrics render only after queue data exists, and queue/detail errors preserve invalid, not-found, forbidden, and failed-read distinctions. Network and 5xx reads are retryable; 400/401/403/404 reads are not automatically retried.

## Internal Dependencies

Disputes, escrows, milestones, jobs, deadlines, conversations, notifications, and users.

## Important Flows

```text
owner session → membership operation → signed contract call → server RPC verification → active app membership
active admin session → claim or owner assignment → assigned-admin review
persist signed settlement identity → submit once → verify exact Stellar invocation → update dispute/escrow/parent + events/notifications
```

## Common Change Locations

Admin request authentication belongs in `core/admin/server-auth.ts`; server Convex calls belong in `server-api.ts`; admin data checks/mappings belong in `admin/helpers.ts`; UI state belongs in the admin feature pages.

## Risks / Gotchas

- The admin Convex secret must never cross into browser code.
- `/api/admin/session` returns the verified wallet plus `isOwner`/`isDisputeAdmin` capabilities with `Cache-Control: no-store`; it never returns the signed session token or Convex secret.
- The owner alone can view platform metrics, manage membership, and assign/reassign cases. Active dispute admins have dispute-console access only; `users.role` grants no admin capability.
- App settlement is limited to the assigned active admin, with the owner able to reconcile an existing attempt. The contract intentionally permits any active, non-conflicted dispute admin to settle directly, independent of app assignment.
- Revocation disables app access when requested, before the owner signs the on-chain revocation. Membership reconciliation verifies the saved transaction and current on-chain membership without resubmitting.
- Settlement hashes and expiry are persisted before submission. Recovery verifies the saved invocation and cannot submit it again. Reassignment is blocked while an attempt is active or its outcome is unknown.
- Keep the initial membership-enabled deployment/database isolated. Existing escrow ID lookup and Convex synchronization are not safe across overlapping contract ID spaces.
- Dispute detail `NOT_FOUND` Convex errors map to HTTP 404 and render a return-to-queue state. Queue failures remain errors rather than becoming an empty queue.
- The shared status contract has eight dispute statuses and four on-chain marking phases. Frontend Developer 1 owns the admin routes/features plus shared dispute types, labels/classification helpers, formatting helpers, and badges; Frontend Developer 2 consumes those exports from participant routes/components.
- The UI/shared executor submits only after the signed hash and expiry are persisted. The API verifies or reconciles the saved transaction identity and applies settlement bookkeeping; recovery never resubmits it.
- A marking failure retry starts a new chain operation; the `mark_failed` label alone does not establish transaction retry safety.
- Metrics are bounded scans and can return `isTruncated`.

## Related Notes

[[architecture/Authentication Boundaries]], [[backend/Admin and Server Routes]], [[modules/Disputes and Cancellations]]
