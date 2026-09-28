---
type: module
area: admin
status: current
last_updated: 2026-09-28
source_of_truth: repository
---

# Admin Operations

## Purpose

Give one configured platform wallet access to metrics, dispute review, moderator notes, and on-chain settlement bookkeeping.

## Current Status

Admin dashboard and dispute console/API routes are implemented. The contract platform admin must match the configured Highrable admin wallet for on-chain escrow operations. The dispute queue and detail pages now verify the signed session through `/api/admin/session` before mounting protected content; the configured wallet is authoritative and the database user role is not used for these two routes. C06 freezes the shared frontend dispute contract in `docs/instawards/C06-Frontend-Handoff.md`; status labels/classification and Convex-derived view-model types are shared with participant routes. This is platform-operated review, not decentralized arbitration.

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

Routes: `/admin`, `/admin/disputes`, `/admin/disputes/[disputeId]`; APIs: metrics, dispute list/detail, status, note, and resolve endpoints. Convex functions: `getAdminDashboardMetrics`, `listAdminDisputes`, `getAdminDispute`, `addModeratorNote`, `changeDisputeReviewStatus`, and resolution-phase mutations.

## Data Model

Admin data is stored on `disputes`, `disputeEvents`, `escrows`, jobs/milestones, and transactions. Admin identity is a configured wallet, not a free-form role claim from the browser.

## External Dependencies

Signed session cookie, environment admin wallet/secret, Convex HTTP client, escrow `resolve_dispute`, and explorer URL metadata.

The dispute pages use an identity-scoped TanStack Query access gate. Queue/detail reads stay unmounted until the server-verified wallet matches the active external wallet; passkey mode is instructed to switch to the external admin wallet. Protected query cache is cancelled/removed on wallet changes, disconnects, and API 401/403 responses. Queue workload metrics render only after queue data exists, and queue/detail errors preserve invalid, not-found, forbidden, and failed-read distinctions. Network and 5xx reads are retryable; 400/401/403/404 reads are not automatically retried.

## Internal Dependencies

Disputes, escrows, milestones, jobs, deadlines, conversations, notifications, and users.

## Important Flows

```text
signed admin session → Next API route → Convex admin function
admin review → on-chain resolve_dispute call → success/failure API phase
success → patch escrow/job/milestone + dispute resolution fields/events/notifications
```

## Common Change Locations

Admin request authentication belongs in `core/admin/server-auth.ts`; server Convex calls belong in `server-api.ts`; admin data checks/mappings belong in `admin/helpers.ts`; UI state belongs in the admin feature pages.

## Risks / Gotchas

- The admin Convex secret must never cross into browser code.
- `/api/admin/session` returns only the verified admin wallet and sends `Cache-Control: no-store`; it never returns the signed session token or Convex secret.
- Dispute detail `NOT_FOUND` Convex errors map to HTTP 404 and render a return-to-queue state. Queue failures remain errors rather than becoming an empty queue.
- The shared status contract has eight dispute statuses and four on-chain marking phases. Frontend Developer 1 owns the admin routes/features plus shared dispute types, labels/classification helpers, formatting helpers, and badges; Frontend Developer 2 consumes those exports from participant routes/components.
- The resolution API records phases; it does not itself submit a Soroban transaction—the UI/helper execution and phase updates are separate.
- A marking failure retry starts a new chain operation; the `mark_failed` label alone does not establish transaction retry safety.
- Metrics are bounded scans and can return `isTruncated`.

## Related Notes

[[architecture/Authentication Boundaries]], [[backend/Admin and Server Routes]], [[modules/Disputes and Cancellations]]
