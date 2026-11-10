# Sprint 2 — Execution and Acceptance

Status: implementation complete in the checkout; acceptance evidence remains pending until the configured real environment is exercised.

## Delivered

- Additive Convex tables and server-authorized functions for text posts, comments, likes, reports, moderation actions, request deduplication, and per-member beta rate windows.
- Session-bound Next.js APIs for posts, post details, likes, comments, reports, moderation reports/actions, and the lightweight update check.
- Unicode-code-point text validation: 3,000 characters for posts/comments and 1,000 characters for report explanations.
- Current profile-name/avatar hydration with an `Unavailable member` fallback and immutable Freelancer/Client publication badges.
- Newest-first post pagination with a first-page cutoff, oldest-first comment pagination, author-only edit/delete, idempotent post/comment creation, explicit like/unlike, report deduplication, and append-only moderation audit records.
- Moderator access based only on the Convex `NEWSFEED_MODERATOR_WALLETS` allowlist. The allowlist is empty by default and does not reuse dispute-admin roles.
- Separate `NEWSFEED_TEXT_ENABLED` flag subordinate to `NEWSFEED_ENABLED`; the existing shell remains available when text is disabled.
- Client feed behavior for drafts, pending/error/empty/retry states, stale-response invalidation on identity changes, thirty-second update polling, focus checks, and a manual “New posts available” refresh.

## Acceptance checklist

The following checks are intentionally pending until they are run against the configured environment. Do not mark them complete from type-check or unit-test results alone.

- [ ] Guest, expired/revoked-session, incomplete-profile, forged-identity, direct-Convex, and cross-origin authorization checks.
- [ ] External-wallet and passkey login, cross-mode visibility, mode changes preserving historical badges, profile rename attribution, and unavailable-author fallback.
- [ ] Concurrent/idempotent post and comment creation, conflicting request IDs, concurrent likes, and accurate aggregate counts.
- [ ] Cursor pagination stability, thirty-second/focus update prompt, hidden/deleted content non-leakage, and interaction rejection after removal.
- [ ] Moderator allowlist access, report queue, hide/restore/dismiss actions, author-deletion terminal behavior, and audit history.
- [ ] Logout/account switching clears feed data and drafts; recoverable failures preserve drafts; keyboard/mobile flows are usable.
- [ ] Frontend/backend tests, type checks, lint, production build, and navigation/onboarding/profile/marketplace regressions.
- [ ] Real-environment external-wallet/passkey smoke tests.
- [ ] 10,000-post/50-user performance exercise with p95 API and first-page measurements recorded.

## Release controls and rollback

Deploy the additive Convex schema/functions before publishing frontend consumers through the existing CI-gated deployment workflow. Keep `NEWSFEED_TEXT_ENABLED=false` until the checklist is accepted. To roll back the beta, set that flag to `false`; records, sessions, identities, and audit history remain intact. Set `NEWSFEED_ENABLED=false` for a full shell withdrawal.

Required Convex configuration:

- `HIGHRABLE_AUTH_SERVICE_SECRET` must match the web server secret.
- `NEWSFEED_ENABLED=true` and `NEWSFEED_TEXT_ENABLED=true` enable text APIs.
- `NEWSFEED_MODERATOR_WALLETS` is a comma-separated allowlist of verified external-wallet or passkey account identities. Empty means no moderator access.

## Evidence to record

Record test command results, environment/flag values without secrets, measured latency/authentication-failure metrics, and moderation queue age. Do not record post contents, session IDs, wallet private keys, seed phrases, or service secrets.


## Partial follow-up evidence

The local production build passed guest access and foreign-Origin photo-boundary checks in Playwright-managed Chromium, Firefox and WebKit, and real Ed25519 signature-verifier tests passed. See [Sprint 3 follow-up acceptance evidence](Sprint-3-Execution-and-Acceptance.md#follow-up-acceptance-attempt). The checklist above remains pending because these checks do not exercise the configured deployment with authenticated users, wallet extensions or passkeys. The inspected development target/local web environment lack the member-auth/newsfeed configuration needed for those checks.


The later user-authorized development run removed the configuration blocker and passed 51 live API assertions plus signed-in four-photo browser flows in Chromium, Firefox and WebKit. See [development deployment acceptance](Sprint-3-Execution-and-Acceptance.md#configured-development-deployment-acceptance). Signed API sessions used genuine Stellar signatures and synthetic named profiles. Real wallet-extension/passkey/onboarding, full interaction/load and physical-device gates remain pending; the broad checklist is not marked complete from this subset.
