---
type: reference
area: backend
status: current
last_updated: 2026-10-23
source_of_truth: repository
---

# Admin and Server Routes

## Next server routes

The admin HTTP boundary is under `apps/web/app/api/admin`. `apps/web/core/admin/server-auth.ts` verifies the signed wallet session and derives the acting wallet from its subject, then supplies the server-only Convex secret to `server-api.ts`. Each protected Convex function independently enforces owner or dispute-admin capability and, for case mutations, assignment and participant-conflict rules.

| Route | Purpose |
| --- | --- |
| `GET /api/admin/session` | Returns the verified normalized wallet plus owner/dispute-admin capabilities. Responses are not cacheable. |
| `GET /api/admin/metrics` | Bounded admin dashboard metrics. |
| `GET /api/admin/admins` / `POST /api/admin/admins` | Owner-only membership listing and grant/revoke operation start. |
| `POST /api/admin/admins/[operationId]/signed` / `recover` / `fail` | Persist, reconcile, or fail an unsubmitted membership operation. Recovery verifies its saved transaction and never resubmits. |
| `GET /api/admin/disputes` | Admin dispute queue. |
| `GET /api/admin/disputes/[disputeId]` | Admin dispute detail. |
| `POST /api/admin/disputes/[disputeId]/claim` / `assignment` | Atomic active-admin claim and owner-only assignment/release. |
| `POST /api/admin/disputes/[disputeId]/status` | Review status update. |
| `POST /api/admin/disputes/[disputeId]/note` | Moderator note. |
| `POST /api/admin/disputes/[disputeId]/resolve` | Persist settlement start/sign identity, recover saved operations, or reconcile a supplied successful prior resolution hash after server RPC verification. |

The admin route handlers validate request bodies with Zod and then call typed Convex server functions. Before recording a new settlement start, the resolve route reads the authorized persisted dispute context and the exact Soroban escrow under Convex's network/contract scope. It requires matching escrow identity and participants plus on-chain `Disputed` status; a mismatch returns a conflict without writing an attempt or transaction. The shared Stellar executor persists a signed transaction hash and expiry before submitting. The resolve route checks the exact contract, method, actor, escrow, and split, and verifies current escrow state before applying existing Convex updates. Recovery never resubmits. Structured Convex application errors preserve their codes at this boundary; `NOT_FOUND` becomes HTTP 404 for detail reads, while malformed requests remain distinct from server failures.

Deliverable 2 C19 additionally verifies the returned transaction envelope hash under the configured network against the saved hash, including inner-hash lookup for fee-bump envelopes. Unknown RPC statuses and unreadable ledger close times cannot be treated as definitive failure/expiry. Escrow reads require the requested escrow ID, recognized status, and readable addresses. Rejected reads leave settlement bookkeeping untouched so the same saved transaction can be checked again. This is covered by the real route/verifier with mocked RPC and Convex transport in `apps/web/core/admin/settlement-recovery.test.ts`.

When a successful resolution was submitted outside the current saved-attempt flow, the same endpoint accepts an explicit transaction hash. It independently parses and verifies the successful RPC envelope against the configured passphrase and contract, `resolve_dispute` method, assigned admin argument, escrow ID, and share, then reads the current escrow and participants before creating or attaching the settlement attempt. The existing success mutation performs the normal terminal updates and side effects. A mismatched or unreadable hash does not update Convex, and this path never calls `sendTransaction`. See [[evidence/Admin-Resolution External Transaction Recovery Evidence]].

## Stellar authentication routes

- `POST /api/auth/stellar/challenge` creates a short-lived challenge and signed challenge cookie.
- `POST /api/auth/stellar/verify` validates the challenge message and Ed25519 signature, consumes the nonce, and creates a signed HTTP-only session cookie.

The challenge/session implementation is in `apps/web/core/wallet/server/auth-store.ts`. Production requires `WALLET_SESSION_SECRET`; development has a fallback warning.

## Velo Gas Station routes

`POST /api/stellar/gas/submit` and `POST /api/stellar/gas/status` are authenticated wallet routes, not admin routes. They use the verified session subject plus a wallet-owned `clientRequestId`, enforce bounded Zod payloads, and persist only safe Velo recovery data through Convex. The submit route accepts one signed Soroban `invokeHostFunction` XDR for the initial handoff; subsequent uncertain execution recovery is status-only.

## Convex admin boundary

`packages/backend/convex/_shared/adminAuth.ts` checks:

1. `HIGHRABLE_ADMIN_CONVEX_SECRET` matches the supplied server secret.
2. `HIGHRABLE_ADMIN_WALLET_ADDRESS` identifies the owner for owner-only functions.
3. Active additional membership exists in `disputeAdmins` for the configured network/escrow contract.

The signed session identifies a wallet; it does not itself grant a capability. `users.role` is not consulted. Grants require the owner-signed contract change and server-side success/current-membership verification. Revocations disable app access immediately and remain incomplete until chain reconciliation.

The `/admin/disputes` and `/admin/disputes/[disputeId]` browser routes use a shared TanStack Query gate against `/api/admin/session`. Protected queue/detail components mount only after the verified wallet matches the active external wallet. This runtime gate does not consult the database user role and removes identity-scoped protected cache on wallet changes, disconnects, or API 401/403 responses.

## Proxy and waitlist

`apps/web/proxy.ts` applies the browser waitlist gate and explicitly excludes API/static paths. It is not a substitute for API authorization and does not protect Convex mutations.

See [[architecture/Authentication Boundaries]], [[modules/Admin Operations]], and [[frontend/Routes and API]].
