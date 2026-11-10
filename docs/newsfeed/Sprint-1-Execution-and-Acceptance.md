# Sprint 1 — Execution and Acceptance

Status: implementation complete; release flag remains off by default.

Sprint 1 delivers NF-01–NF-04: persisted verified sessions for external wallets and passkey smart accounts, protected member/profile writes, session lifecycle handling, and the Newsfeed shell/navigation gate.

## Delivered implementation

### Verified sessions

- Convex stores single-use challenges, persisted sessions, and persistent authentication rate-limit windows.
- External wallet login keeps the existing Stellar message-signature flow, but challenge consumption and session creation happen atomically in Convex.
- Passkey login uses WebAuthn challenge/verification on the server and binds the assertion to the selected smart account’s active default context-rule signer.
- Passkey accounts must be deployed `C…` contracts, use the configured WebAuthn verifier, expose a P-256 public key plus credential ID, and use the default rule. RPC failure, missing deployment, removed signer, mismatched credential, or specialized-only rules fail closed.
- Verification responses contain session metadata but never a bearer session token. The browser only receives opaque HttpOnly cookies.

### Session lifecycle

- `GET /api/auth/session` validates the persisted cookie and returns identity, expiry, profile summary, and onboarding eligibility.
- `POST /api/auth/logout` revokes the persisted session and clears the cookie.
- The shared wallet provider rechecks on reload, focus, explicit refresh events, and a 30-second interval.
- Disconnects and wallet/account switches revoke the prior session, clear member state, and broadcast a cross-tab invalidation event.
- Admin and Gas Station server readers use the persisted session validator while retaining their existing separate authorization checks.
- Cookie-authenticated mutations enforce same-origin requests; external-wallet and passkey challenge/verification flows use persistent Convex-backed throttling.

### Protected identity writes

- Browser profile/onboarding/identity calls now go through `/api/member/*` routes.
- The server derives the wallet address and wallet type from the verified session; browser-supplied identity targets are not trusted.
- Direct Convex calls to user/profile identity mutations require the dedicated `HIGHRABLE_AUTH_SERVICE_SECRET`.
- Avatar issuance and finalization use expiring upload intents, storage metadata validation, and ownership checks before profile association.
- Newsfeed eligibility requires a live session, completed onboarding, and a nonempty profile name.

### Newsfeed shell

- `/newsfeed`, `/api/newsfeed/config`, and `/api/newsfeed/access` are implemented behind `NEWSFEED_ENABLED` (default `false`).
- Guests receive a sign-in gate with no member data; incomplete members receive a profile-completion path; eligible members see the empty Sprint 1 shell.
- Eligible members see Newsfeed as the first Freelancer and Client navigation item on desktop and mobile. Existing landing and admin navigation remain unchanged.

## Acceptance evidence

Automated checks completed during implementation:

- `pnpm --filter web typecheck`
- `pnpm --filter @repo/backend typecheck`
- `pnpm --filter web test`
- `pnpm --filter @repo/backend test`
- `pnpm --filter web lint:check`
- `pnpm --filter @repo/backend lint:check`
- `pnpm --filter web build`

The automated suites cover existing onboarding, registry registration, admin authorization, Gas Station session boundaries, wallet restoration, and the updated persisted-session fixtures. Real external-wallet and passkey smoke tests still require the configured deployment, RPC source account, WebAuthn verifier, and browser wallet/passkey environments.

## Required deployment configuration

- Set the same high-entropy `HIGHRABLE_AUTH_SERVICE_SECRET` in the web server and Convex environment. Do not reuse the admin secret.
- Set `STELLAR_READ_SOURCE_ACCOUNT` on the web server for server-side smart-account RPC simulation.
- Set the WebAuthn verifier contract and existing smart-account public configuration before enabling passkey sign-in.
- Set `NEWSFEED_ENABLED=false` until both authentication methods and the protected profile flows pass real-environment smoke tests; enable it to release the shell.

Session IDs are cryptographically random persisted records; the old HMAC/stateless `WALLET_SESSION_SECRET` configuration is no longer used.

## Rollout and rollback

Deploy the additive Convex schema/functions first, then the web routes and consumers. Keep the Newsfeed flag off during verification. If the shell needs to be withdrawn, turn the flag off; retain the persisted-session and identity protections. Do not restore the removed stateless session or public identity-write paths.

Sprint 2 remains responsible for posts, comments, likes, reports, moderation, and feed pagination.
