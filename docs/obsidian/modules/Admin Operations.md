---
type: module
area: admin
status: current
last_updated: 2026-10-06
source_of_truth: repository
---

# Admin Operations

## Purpose

Give the configured platform owner access to platform metrics and owner controls, with a separately managed team of external-wallet dispute admins for case review and settlement.

## Current Status

Admin dashboard, owner-managed dispute-admin membership, case assignment, and dispute settlement recovery are implemented in source. C14 adds frontend settlement hardening: resolution input is strict and text-preserving, fixed outcomes map to 0/10000 bps, split input accepts whole-number 1–9999 bps, and the optional note remains capped at 2,000 characters. C18 adds an admin settlement coordinator with explicit preparation, simulation, signing, signed-identity recording, submission, confirmation, final-recording, pending, and reconciliation feedback. The executor reports phases without changing routing and preserves the locally computed hash for submission/confirmation uncertainty, including sponsored execution. Resolution API results are typed and recognized outcomes only; `pending` and verified `failed` never render success. Reconciliation is manual and status-only, while signed operation context and a configured explorer link remain visible until the server establishes an outcome. C22 adds mocked protected-page integration and deferred coordinator regression coverage; the focused administrator suite passes 135 tests and the full web suite passes 211 tests. Settlement is enabled only for an assigned, nonparticipant admin using the verified, connected, signing-capable external wallet on the configured network, for one of the four nonterminal review statuses, with `marked` dispute state, an on-chain escrow ID, a `disputed` escrow mirror, and no active settlement attempt or concurrent action. The current recorded contract deployments predate dispute-admin membership; the new contract behavior is undeployed and requires a fresh isolated deployment. The platform owner remains `HIGHRABLE_ADMIN_WALLET_ADDRESS`; external dispute admins are stored separately from `users.role` and scoped to the configured Stellar network and escrow contract. C06 freezes the shared frontend dispute contract in `docs/instawards/C06-Frontend-Handoff.md`. This is platform-operated review, not decentralized arbitration.

Deliverable 2 C03 adds runtime validation for successful admin-session payloads, limits session retries to network/5xx failures, and closes an already-loaded owner queue when its membership read returns 401/403, including protected-cache eviction against late responses. C03 validation passes 119 focused administrator tests, 255 full web tests, and the web production build. This is mocked browser/API regression evidence, not live-chain verification or completion of Day 1 or the full sprint.

## Deliverable 2 C11 - Admin Evidence Review

The protected admin detail page now renders `IAdminDisputeDetail.dispute.attachments` in a dedicated case-evidence section, while timeline attachments remain associated with their source events. The shared `AdminEvidenceList` compares referenced attachment IDs with returned records, distinguishes `No evidence attached.` from `Evidence unavailable`, displays attachment metadata, validates HTTP/HTTPS opening URLs, and provides descriptive new-tab links only for active usable evidence. Deleted, blocked, missing, null-URL, and unsafe evidence has no opening action.

Detail refresh uses the existing protected GET query, shows in-progress feedback, prevents duplicate refreshes, replaces returned evidence/status, and fail-closes on 404 or authorization failures while preserving recoverable network/5xx retry behavior. The focused administrator suite passes 173 tests; the full web suite passes 286 tests; web TypeScript, scoped oxlint/oxfmt, and the production build pass. This is mocked local UI/session/API evidence only; no live deployment or chain verification was performed. See `docs/instawards/Deliverable-2-C11-Admin-Evidence-Review-Evidence.md`.

## Deliverable 2 C12 - Admin Assignment and Review Controls

Queue and detail controls now mirror the existing backend policy before issuing writes: claim requires an unassigned, nonterminal case and a verified nonparticipant admin; assignment requires a verified nonparticipant owner; review-status changes require the assigned, nonparticipant admin on a nonterminal case. Assignee wallets are normalized and deduplicated, participant wallets are excluded, inactive historical assignees remain visible only as disabled unavailable options, and owner assignment stays disabled until membership loading succeeds. Detail reassignment is disabled during active settlement attempts while preserving backend-permitted terminal-case owner reassignment.

Assignment, claim, and review actions reject overlapping submissions, clear stale success feedback, preserve rejected review drafts, and invalidate every queue-filter cache plus the affected wallet-scoped detail cache after a successful write. Refreshes are explicit and non-optimistic. A successful write followed by a failed read exposes a read-only retry and never repeats the mutation; rejected writes retain the backend conflict message. The shared session gate still owns 401/403 handling and protected-cache eviction. The C12 focused administrator coverage passes 190 tests; the full web suite passes 303 tests; web TypeScript, scoped oxlint/oxfmt, and the production build pass. This is mocked local UI/session/API evidence only: backend policy, signed-session authentication, Convex authorization, audit/notification side effects, contracts, schemas, and Stellar transaction behavior were not changed or live-verified. See `docs/obsidian/evidence/C12-Administrator Assignment Review Evidence.md`.

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
- Keep settlement controls accessible with inline input errors and a specific unavailable-state explanation; revalidate local eligibility, signed-session wallet identity, on-chain membership, simulation, and persisted signed-hash recovery before execution.

## Main Entry Points

Routes: `/admin`, `/admin/admins`, `/admin/disputes`, `/admin/disputes/[disputeId]`; APIs cover metrics, capability/session checks, membership operations/recovery, queue/detail, claim/assignment, notes/status, and settlement recovery. Convex functions include `getAdminDashboardMetrics`, `getAdminCapabilities`, `listDisputeAdmins`, `claimDispute`, `assignDispute`, `addModeratorNote`, `changeDisputeReviewStatus`, and settlement/membership operation mutations.

The `/dashboard` admin-profile branch uses the verified capability response as an entry router. The shared dispute-capability session gate must first verify the connected external wallet; verified owners render the existing platform dashboard, while verified dispute admins without owner capability are redirected with history replacement to `/admin/disputes`. The profile-role selection remains the entry condition and is not an authorization source.

## Data Model

Admin data is stored on disputes/events, scoped disputeAdmins and disputeAdminOperations, assignment audit events, settlement attempts, escrows, parent jobs/milestones, and transactions. Cases start unassigned. Admin identity comes from a verified signed wallet session; Convex independently checks the server secret and owner or active scoped membership.

## External Dependencies

Signed external-wallet session cookie, owner/secret/network/contract environment configuration, Convex HTTP client, escrow membership/settlement methods, Soroban RPC reconciliation, and explorer URL metadata.

The dispute pages use an identity-scoped TanStack Query access gate. Queue/detail reads stay unmounted until the server-verified wallet matches the active external wallet; if the signed cookie belongs to another wallet, the gate offers authentication for the connected wallet and checks its capability before mounting protected content. Passkey mode is instructed to switch to the external admin wallet. Protected query cache is cancelled/removed on wallet changes, disconnects, and API 401/403 responses. Queue workload metrics render only after queue data exists, and queue/detail errors preserve invalid, not-found, forbidden, and failed-read distinctions. Network and 5xx reads are retryable; 400/401/403/404 reads are not automatically retried.

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
- A successful but malformed session payload is rejected with a generic client error and cannot open protected content; only a manual access-check retry can recover it.
- The owner alone can view platform metrics, manage membership, and assign/reassign cases. Active dispute admins have dispute-console access only; `users.role` grants no admin capability.
- Owner queue membership 401/403 responses close the protected surface and evict protected queue/membership caches; a late queue response cannot restore the removed content.
- App settlement is limited to the assigned active admin, with the owner able to reconcile an existing attempt. The contract intentionally permits any active, non-conflicted dispute admin to settle directly, independent of app assignment.
- Revocation disables app access when requested, before the owner signs the on-chain revocation. Membership reconciliation verifies the saved transaction and current on-chain membership without resubmitting.
- Settlement hashes and expiry are persisted before submission. Recovery verifies the saved invocation and cannot submit it again. Reassignment is blocked while an attempt is active or its outcome is unknown.
- Keep the initial membership-enabled deployment/database isolated. Existing escrow ID lookup and Convex synchronization are not safe across overlapping contract ID spaces.
- Dispute detail `NOT_FOUND` Convex errors map to HTTP 404 and render a return-to-queue state. Queue failures remain errors rather than becoming an empty queue.
- The shared status contract has eight dispute statuses and four on-chain marking phases. Frontend Developer 1 owns the admin routes/features plus shared dispute types, labels/classification helpers, formatting helpers, and badges; Frontend Developer 2 consumes those exports from participant routes/components.
- The UI/shared executor submits only after the signed hash and expiry are persisted. The API verifies or reconciles the saved transaction identity and applies settlement bookkeeping; recovery never resubmits it.
- C18 local progress phases are presentation state, not persisted dispute statuses. A failed detail refresh after settlement recording exposes a read-only retry and never repeats settlement bookkeeping.
- A marking failure retry starts a new chain operation; the `mark_failed` label alone does not establish transaction retry safety.
- C14 settlement eligibility accepts `open`, `under_review`, `awaiting_client_response`, and `awaiting_freelancer_response`, but requires `marked` dispute state plus a `disputed` escrow mirror. Invalid bps text is retained for correction, and active settlement attempts disable new settlement while preserving reconciliation controls. Stellar simulation remains authoritative when the local mirror is stale.
- C17 validates integer resolution basis points, 64-hex hashes, positive safe-integer expiries, normalized operation IDs, saved escrow/scope/terms, and non-empty failure messages. Matching callbacks are authorized before replay no-ops; signed/unknown callbacks retain their first phase and error, while owner recovery preserves the initiating administrator as the settlement actor.
- Settlement audit events carry the operation identity and failure events carry any known transaction hash. Existing event types, public callback arguments, table fields, and server-side RPC verification boundary are unchanged.
- Deliverable 2 C17 regression coverage expands the earlier implementation evidence to 32 focused tests. It covers normalized active-start identity, conflicting operation terms, failed-ID reuse, all active-attempt phases including compatibility `submitted`, same-escrow dispute locking, independent escrows, signed hash/expiry identity, missing callbacks, phase guards, terminal/non-disputed replay paths, scoped authorization, participant conflicts, full-record rollback, and one-time side effects. Focused C17+C21 coverage passes 50 tests and the full backend passes 330 tests across 12 files; no production violation was demonstrated or fixed. See the [C17 settlement-attempt evidence map](../evidence/C17-Settlement%20Attempt%20Regression%20Evidence.md).
- Whole-unit payout truncation remains a known bookkeeping limitation; token-precision settlement arithmetic is a separate follow-up.
- A marking failure retry starts a new chain operation; the `mark_failed` label alone does not establish transaction retry safety. C13 permits a retry only when no failed transaction hash is recorded, makes same-hash success replay harmless, and ignores stale failures after confirmation while rejecting conflicting hashes.
- Review controls are limited to the three nonterminal review targets `under_review`, `awaiting_client_response`, and `awaiting_freelancer_response`. An `open` case initializes the selector to `under_review`; loaded review status is reapplied when the case or server status changes, while unsaved selection remains local until submission.
- The UI enables review controls only when the server-verified wallet is the assigned admin, is neither participant, and the case is nonterminal. Convex remains authoritative. A successful status write clears the message draft, invalidates that wallet's queue caches across filters, and refetches detail/timeline without optimistic status changes; rejected writes preserve drafts, while a failed post-write refresh offers a read retry without resubmitting.
- Metrics are bounded scans and can return `isTruncated`.

## Related Notes

[[architecture/Authentication Boundaries]], [[backend/Admin and Server Routes]], [[modules/Disputes and Cancellations]]
