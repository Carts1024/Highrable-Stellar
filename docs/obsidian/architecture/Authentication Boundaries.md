---
type: architecture
area: security
status: current
last_updated: 2026-10-15
source_of_truth: repository
---

# Authentication Boundaries

## Stellar challenge/verify

The web app exposes:

- `POST /api/auth/stellar/challenge`: validates a `G...` address, creates a nonce/message with domain/network/expiry, and sets a signed challenge cookie.
- `POST /api/auth/stellar/verify`: validates the challenge cookie and message, verifies the Ed25519 Stellar signed message, consumes the nonce, and sets a signed HTTP-only session cookie.

`apps/web/core/wallet/server/auth-store.ts` uses HMAC-signed payloads. Challenges live for five minutes; sessions live for 24 hours. Production requires `WALLET_SESSION_SECRET`; development has a fallback warning.

`apps/web/core/wallet/server/signature.ts` decodes Stellar public keys and accepts the Freighter-style prefixed hash or raw message verification path.

## Velo Gas Station handoff

The Testnet-only Velo routes require the signed HTTP-only session cookie and use its verified `sub` wallet as the transaction source. They additionally require an existing wallet-owned Convex transaction row keyed by the client operation ID. The browser may send the wallet-signed inner XDR only to the submit route; the server validates it and keeps the Velo key, deployment URL, and recovery calls server-side. The status route accepts only the stored request/inner-hash identity.

## Admin boundary

Admin Next routes call `requireAdminRequestContext`:

1. Read the signed session cookie.
2. Verify its signature and expiry.
3. Normalize and use the verified session subject as the acting wallet.
4. Pass `HIGHRABLE_ADMIN_CONVEX_SECRET` to server-only Convex admin functions.

Convex admin functions independently check the shared secret and then enforce owner-only or active dispute-admin capability, network/contract scope, case assignment, and participant conflicts. `HIGHRABLE_ADMIN_WALLET_ADDRESS` identifies the platform owner. Additional wallets are authorized through the scoped `disputeAdmins` table after a verified contract grant; `users.role` does not grant access.

`GET /api/admin/session` returns the verified normalized wallet and `isOwner`/`isDisputeAdmin` capabilities with caching disabled. The browser parses the response as unknown and requires the existing Stellar public-key schema plus strict booleans; additive response fields remain compatible, while malformed successful responses become a generic, non-payload-bearing client error. The dispute queue/detail and owner-only pages use the shared runtime gate. Protected content is not mounted before verification, and TanStack queries are scoped by the verified wallet with cancellation and cache cleanup on disconnect, wallet change, or API 401/403, including owner queue membership reads. Session and protected reads retry only network/5xx failures, at most twice; invalid session responses require a manual access-check retry. Admin sign-in remains external-wallet-only; passkey admin authentication is not supported.

Membership grants become active only after the saved contract transaction succeeds and current membership is verified. Revocation blocks app access immediately and remains incomplete until the owner-signed contract change is reconciled. Settlement recovery verifies a persisted transaction hash and its exact contract invocation server-side; recovery does not submit another transaction.

## Public Convex limitation

The session cookie is not automatically attached as Convex identity for all public mutations. Several public mutations accept a `walletAddress`/`clientWallet`/`freelancerWallet` argument and compare it to stored participants. Source comments mark these as TODOs for signed-session replacement. This is a known authorization limitation.

`saveProfileDraft` and `completeOnboarding` retain the repository's caller-supplied-wallet boundary. Completion additionally requires a registry mirror row created by the internal mutation called from `syncUserRegistration`; that public action validates configured scope and reads the public chain record through Stellar RPC. The sync action is permissionless and records only public chain facts. It does not authenticate its caller or accept profile edits. The registry contract itself requires `user.require_auth()` for both first-time and duplicate registration calls; anyone may invoke it directly, and registration is not Highrable identity approval.
## C10 current-work and protected-read boundary

Dispute participant reads and evidence/response writes still accept caller-supplied wallet values; C10 does not prove possession. Those values are now checked against the saved dispute participants and the current resolved parent graph, including populated legacy links and explicit escrow aliases. Terminal cases remain readable only while those relationships still match; reassignment does not grant the former or replacement participant access to the old case.

Protected context reads return `null` before loading protected context for omitted, blank, or unrelated viewers. Returned submissions, revisions and their linked submissions, and deadlines are filtered against the resolved work. Case/timeline attachment access requires an active attachment associated with the exact dispute and a valid participant uploader role before the uploader shortcut, including preview, download, and direct upload paths. Administrator review retains its existing secret, capability, and scope checks and applies the same case-association validation while preserving historical review access.

## Route gate distinction

`apps/web/proxy.ts` is a waitlist browser route gate. It excludes `/api` and does not replace authentication or authorization. Wallet-required UI guards also do not prove a server-side wallet signature.

See [[stellar/Wallet Identity Model]], [[backend/Admin and Server Routes]], and [[operations/Security and Secrets]].
