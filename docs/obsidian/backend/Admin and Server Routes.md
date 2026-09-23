---
type: reference
area: backend
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Admin and Server Routes

## Next server routes

The admin HTTP boundary is under `apps/web/app/api/admin`. `apps/web/core/admin/server-auth.ts` verifies the signed wallet session, checks the configured admin wallet, and supplies the server-only Convex secret to `server-api.ts`.

| Route | Purpose |
| --- | --- |
| `GET /api/admin/metrics` | Bounded admin dashboard metrics. |
| `GET /api/admin/disputes` | Admin dispute queue. |
| `GET /api/admin/disputes/[disputeId]` | Admin dispute detail. |
| `POST /api/admin/disputes/[disputeId]/status` | Review status update. |
| `POST /api/admin/disputes/[disputeId]/note` | Moderator note. |
| `POST /api/admin/disputes/[disputeId]/resolve` | Resolution phase and share bookkeeping. |

The admin route handlers validate request bodies with Zod and then call typed Convex server functions. The chain settlement call is performed by the product/stellar flow; the resolve route records the appropriate started/succeeded/failed phase and resolution data.

## Stellar authentication routes

- `POST /api/auth/stellar/challenge` creates a short-lived challenge and signed challenge cookie.
- `POST /api/auth/stellar/verify` validates the challenge message and Ed25519 signature, consumes the nonce, and creates a signed HTTP-only session cookie.

The challenge/session implementation is in `apps/web/core/wallet/server/auth-store.ts`. Production requires `WALLET_SESSION_SECRET`; development has a fallback warning.

## Convex admin boundary

`packages/backend/convex/_shared/adminAuth.ts` independently checks:

1. `HIGHRABLE_ADMIN_WALLET_ADDRESS` matches the normalized supplied admin wallet.
2. `HIGHRABLE_ADMIN_CONVEX_SECRET` matches the supplied server secret.

The duplicated check is intentional: the Next route and Convex function boundary each enforce their own side of the admin trust boundary.

## Proxy and waitlist

`apps/web/proxy.ts` applies the browser waitlist gate and explicitly excludes API/static paths. It is not a substitute for API authorization and does not protect Convex mutations.

See [[architecture/Authentication Boundaries]], [[modules/Admin Operations]], and [[frontend/Routes and API]].
