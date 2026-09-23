---
type: architecture
area: security
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Authentication Boundaries

## Stellar challenge/verify

The web app exposes:

- `POST /api/auth/stellar/challenge`: validates a `G...` address, creates a nonce/message with domain/network/expiry, and sets a signed challenge cookie.
- `POST /api/auth/stellar/verify`: validates the challenge cookie and message, verifies the Ed25519 Stellar signed message, consumes the nonce, and sets a signed HTTP-only session cookie.

`apps/web/core/wallet/server/auth-store.ts` uses HMAC-signed payloads. Challenges live for five minutes; sessions live for 24 hours. Production requires `WALLET_SESSION_SECRET`; development has a fallback warning.

`apps/web/core/wallet/server/signature.ts` decodes Stellar public keys and accepts the Freighter-style prefixed hash or raw message verification path.

## Admin boundary

Admin Next routes call `requireAdminRequestContext`:

1. Read the signed session cookie.
2. Verify its signature and expiry.
3. Compare the session subject to `HIGHRABLE_ADMIN_WALLET_ADDRESS`.
4. Pass `HIGHRABLE_ADMIN_CONVEX_SECRET` to server-only Convex admin functions.

Convex admin helpers independently check the normalized admin wallet and shared secret. Admin pages and API routes cover metrics, dispute lists/detail, review status, moderator notes, and settlement phases.

## Public Convex limitation

The session cookie is not automatically attached as Convex identity for all public mutations. Several public mutations accept a `walletAddress`/`clientWallet`/`freelancerWallet` argument and compare it to stored participants. Source comments mark these as TODOs for signed-session replacement. This is a known authorization limitation.

## Route gate distinction

`apps/web/proxy.ts` is a waitlist browser route gate. It excludes `/api` and does not replace authentication or authorization. Wallet-required UI guards also do not prove a server-side wallet signature.

See [[stellar/Wallet Identity Model]], [[backend/Admin and Server Routes]], and [[operations/Security and Secrets]].
