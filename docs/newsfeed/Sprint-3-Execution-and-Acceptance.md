# Sprint 3 — Photos and Camera Capture

## Release status

NF-09–NF-11 are implemented behind `NEWSFEED_PHOTOS_ENABLED=false`. Photo release is **not approved** until the outstanding Sprint 2 authentication/authorization acceptance and the device/deployment checks below have evidence. No production release was performed. Development-only flags were temporarily enabled for the authorized acceptance run and then restored. Dates remain relative to sprint start.

## Configuration and deployment

| Setting                                     | Location                                 | Behavior                                                                                                |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `NEWSFEED_ENABLED`, `NEWSFEED_TEXT_ENABLED` | Web and Convex                           | Both must be `true` for newsfeed access.                                                                |
| `NEWSFEED_PHOTOS_ENABLED`                   | Web and Convex                           | Defaults to false; subordinate to both existing flags.                                                  |
| `NEWSFEED_CONVEX_HTTP_URL`                  | Web server                               | Deployment HTTP origin, e.g. `https://your-deployment.convex.site`, not the `.convex.cloud` API origin. |
| `NEWSFEED_APP_ORIGINS`                      | Convex                                   | Exact comma-separated browser origins, including scheme and port. No wildcard.                          |
| `HIGHRABLE_AUTH_SERVICE_SECRET`             | Existing web/Convex secret configuration | Existing member-service boundary; never expose to the browser.                                          |
| `NEWSFEED_MODERATOR_WALLETS`                | Convex                                   | Existing explicit moderator allowlist.                                                                  |

Use the existing CI-gated `.github/workflows/deploy.yml` release. Its release script already deploys Convex before building/publishing the web application. Additive schema changes include uploads, short-lived read grants, a reconciliation cursor, optional post photos, and storage indexes. `packages/backend/convex.json` externalizes the native `sharp` dependency for Convex Node actions. No smart-contract changes or additional storage service are needed.

## Implemented flow and limits

- Reserve at `POST /api/newsfeed/uploads`; inspect/cancel with `GET`/`DELETE /api/newsfeed/uploads/[uploadId]`. Next.js issues a random upload credential and sends only its SHA-256 digest to Convex. Credentials expire after five minutes and are consumed atomically before receiving bytes.
- Transfer directly to `POST /newsfeed/photos?uploadId=…` on the Convex HTTP origin with a bearer credential. Next.js handles metadata only, avoiding [Vercel's request payload limit](https://vercel.com/docs/errors/function_payload_too_large).
- Enforce 10 reservations per member per minute and eight active unattached reservations. Allow four distinct, ordered photos per post. An upload must belong to the same authenticated member and session at publication.
- Accept still JPEG, PNG and WebP, up to **10,485,760 bytes each**, inclusive, and 40,000,000 decoded pixels. Count received bytes while reading the stream. Sharp identifies the actual format and fully decodes the image; filename/MIME claims are not authoritative. Animated/multipage files and HEIC/HEIF are rejected. Camera users receive guidance to export unsupported captures as JPEG.
- Store incoming bytes with a dedicated `application/x-highrable-newsfeed` storage marker; finalize metadata and storage association only from internal server operations after decoding. The marker also protects files during the gap before finalization.
- The composer uploads sequentially, provides previews/progress/removal/retry, and requires trimmed descriptions of 1–500 Unicode code points. Drafts remain in memory. Failed publication preserves the payload and request ID; ordered upload IDs and descriptions participate in backend deduplication. Text-only and media-only posts work; comments keep their existing nonempty-text rules.
- Publication atomically attaches ready uploads. Photos, order and descriptions are immutable afterward; text remains editable, including empty text on photo posts. Existing posts serialize with `photos: []`.
- `POST /api/newsfeed/media` issues a 60-second media-specific read credential. `GET /newsfeed/photos` rechecks session, named profile, release flags and parent visibility before serving bytes. Responses use `private, no-store`, exact-origin CORS and `nosniff`; browser DTOs contain opaque media IDs and dimensions, never storage IDs or permanent storage URLs. This uses [Convex's HTTP-action serving pattern](https://docs.convex.dev/file-storage/serve-files).
- Images load on intersection into object URLs, reserve their dimensions, and expose descriptions as alternative text. Account changes/unmount revoke URLs and abort transfers. Visible images reauthorize every 30 seconds without redownloading already-loaded bytes; access failure revokes the local URL. Release configuration refreshes every 30 seconds. A server-side revocation blocks new requests immediately; already displayed content is discarded at the next client recheck.
- Hidden media is available only through `POST /api/newsfeed/moderation/media` authorization to an allowlisted moderator; the report queue links to inspection. Author deletion is terminal and immediately prevents reads. Hidden files remain restorable.

## Cleanup and shared storage audit

Cancellation immediately changes lifecycle state and makes finalization/publication fail. Author deletion queues files for deletion by setting their expiration to zero. Unattached uploads expire after 24 hours. The 15-minute cleanup job processes at most 100 expired uploads, 500 expired read grants and 100 storage records per transaction; full expiration batches schedule another bounded transaction. Cleanup does not depend on release flags.

Compensating deletion checks association before removing a stored file, so a lost finalization response cannot delete a successfully finalized or attached file. A persisted cursor scans marked storage objects older than 24 hours, checking newsfeed uploads, attachments, avatar intents and user avatar references before deleting an orphan. Unmarked storage is never reconciled by this job. Concurrent cleanup/publication is serialized by Convex transactions.

Shared attachment association, avatar finalization/profile validation, avatar URL resolution, attachment serialization/access grants, cancellation evidence URLs and administrator evidence URLs reject newsfeed-owned storage. Tests account for `convex-test` 0.0.60 omitting Blob content type by explicitly seeding system metadata in the orphan fixture.

## Automated evidence

| Check                                | Result                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Frontend suite                       | 48 files / 593 tests passed. After the final access-restoration fix, all six focused photo composer/display tests passed.                                |
| Backend suite                        | 28 files / 556 tests passed, including 12 photo lifecycle/decoder tests.      |
| Frontend/backend TypeScript          | Passed.                                                     |
| Production `pnpm --filter web build` | Passed. Turbopack initially required a sandbox permission retry to start its local CSS worker. |
| Lint                                 | Frontend/backend lint passed with no errors; existing frontend warnings remain. No warnings in the added photo files.    |

`packages/backend/tests/newsfeed/photos.test.ts` covers four-photo publication, ordered retry fingerprints, five/duplicate/description rejection, ownership, session revocation, service-secret rejection, replay, reservation limits, cancellation/finalization ordering, expiration, compensation, hide/restore/delete read behavior, flags, HTTP origin denial, validated HTTP upload/read and cross-domain orphan preservation. `photo-decoding.test.ts` covers supported formats, forged metadata independence, exact 10 MB, oversize/empty/malformed/truncated/unsupported images and excessive pixels. Existing text-feed tests remain green.

`apps/web/features/newsfeed/photos.test.tsx` covers sequential transfer, recovery from a lost upload response, description preservation, object-URL cleanup, removal/cancellation, camera cancellation, HEIC/five-file rejection, separate camera/file controls and required descriptions. Protected-display tests verify the explicit moderation endpoint, local object URLs, revocation on access failure and reloading after restoration.

## Required release evidence still pending

These checks require real devices, deployed infrastructure or authenticated interactive sessions; automated simulations do not replace them.

- [ ] Resolve and record all outstanding Sprint 2 authentication/authorization checks, including external wallet and passkey login, session expiration/logout/switching and incomplete profiles.
- [x] Exercise a deployed exact-10-MB upload through the configured Convex HTTP origin; verify native Sharp deployment, stored marker metadata, correct CORS, successful publication/read and no storage-ID/URL leakage.
- [ ] iOS Safari and Android Chrome: rear-camera preference, capture cancellation, permission denial/fallback, HEIC rejection, interrupted network and retry.
- [ ] Desktop Chrome, Firefox and Safari: choose/view four photos, mixed text/media, keyboard navigation and screen-reader descriptions/loading/errors.
- [ ] Deployed hide/restore/delete, cancellation and publication/cleanup races, old/replayed credentials, arbitrary storage adoption attempts, session revocation during transfer/read.
- [ ] Wallet/passkey, onboarding, avatar and marketplace smoke tests against the release candidate.
- [ ] Record upload failure rate, cleanup failures/backlog, storage consumption and media latency before enabling the flag.

## Monitoring and rollback

HTTP actions emit `newsfeed_photo_upload` and `newsfeed_media_read` events with success, duration and (for successful transfers) byte counts. Cleanup emits scanned-record/byte counts and expired-upload counts; failed cron/scheduled invocations appear in Convex function logs. No credentials, image contents, filenames or descriptions are logged. Use Convex storage usage for total consumption; scanned bytes are a batch measure, not a total-storage gauge. Establish deployed baselines and alerts during acceptance.

Rollback by disabling `NEWSFEED_PHOTOS_ENABLED` in Convex immediately and in the web environment, then redeploying the web application through the normal workflow. Upload and delivery fail closed, controls disappear and existing media shows an unavailable placeholder. Keep the additive backend/schema and cleanup running; do not roll back to code that exposes newsfeed bytes via shared storage endpoints. Preserve hidden files for restoration. Re-enable only after the failed gate has evidence and both environments agree.

## Relative delivery sequence

Days 1–2: lifecycle/auth/storage audit. Days 3–4: byte validation/finalization/cleanup. Days 5–6: composer/capture. Days 7–8: protected display/moderation/idempotency. Days 9–10: automated regression and device/deployed acceptance. Re-estimate if unresolved Sprint 2 access failures consume implementation time. The absent `docs/obsidian/` vault was not recreated.


## Follow-up acceptance attempt

Local production-build checks were executed using Playwright-managed Chromium, Firefox and WebKit. All three engines rendered the Newsfeed sign-in gate without feed content. Request-context checks against the running server returned 401 for guests at posts/access/upload/media/moderation-media endpoints and 403 for foreign-Origin photo requests. Configuration returned the expected temporary process-only flags. See [machine-readable browser evidence](evidence/sprint-3-local-browser-access.json). These results cover the local guest boundary, not deployed authenticated behavior, physical Safari/iOS/Android capture or a screen-reader audit.

Two additional cryptographic acceptance tests passed in `apps/web/core/wallet/server/signature.test.ts`: real Ed25519 signatures in raw and Freighter-prefixed forms (hex/base64), plus rejection of wrong wallets, modified challenges, malformed addresses and malformed signatures. Lint passed for the added tests. These are signature-verifier checks, not wallet-extension or passkey login smoke tests.

Environment discovery found a configured **development** Convex target. Read-only deployment inspection returned no newsfeed/auth service configuration; the local web environment also lacks `HIGHRABLE_AUTH_SERVICE_SECRET` and the photo settings. No deployment secret, flag or user data was changed. Signed-in/deployed 10 MB tests and operational measurements remain blocked until the acceptance target is selected and its authentication/photo configuration is prepared. Physical-device and real wallet/passkey checks remain pending. Do not enable the release flag based on the local evidence alone.


## Configured development deployment acceptance

The configured development Convex deployment was selected by the user. The current backend was deployed there, the member-service authentication secret was configured and matched in the ignored local web environment, and the photo HTTP origin was configured. Production was not changed. A local production-build Next.js gateway exercised the real remote backend. Fresh random Stellar wallets signed genuine authentication challenges; temporary internal fixtures supplied explicitly synthetic named profiles. This verifies signed API sessions and member access, not wallet-extension UI, registry onboarding or passkey hardware.

**51 live API assertions passed.** See [development API evidence](evidence/sprint-3-development-api.json). Coverage includes forged signatures, challenge replay, incomplete profiles, exact-size upload, single-use credentials, actual storage marker/size, four-photo media-only publication, five-photo rejection, foreign ownership, retry deduplication, mode attribution, empty text edits, private protected delivery, moderator allowlisting, hidden/restore/deleted access, cancellation, actual oversized bytes, permanent cleanup, expired sessions, logout/revoked-session replay and unauthorized direct backend mutation.

**Nine signed-in browser assertions passed across Chromium, Firefox and WebKit.** See [development browser evidence](evidence/sprint-3-development-browsers.json). Each engine selected four photos, uploaded sequentially, filled accessible descriptions, published and decoded protected grid images, verified the separate capture control, and cleared feed/media after logout. WebKit initially did not send production Secure cookies over the local HTTP setup; it passed with a temporary local HTTPS gateway. No application authentication or cookie protection was relaxed. These are browser-engine tests, not physical iOS/Android camera or screen-reader acceptance.

### Observed development measurements

- Successful exact **10,485,760-byte** uploads: 3,525 ms and 5,240 ms across two live runs.
- Protected downloads of the same byte count: 1,468 ms and 1,326 ms, with `private, no-store` responses.
- Eight valid API-run photo transfers succeeded; intentional replay/cancellation/oversize rejections are negative tests, not operational upload failures. Browser runs added twelve successful photo uploads. These small synthetic samples are not a production failure-rate or p95 baseline.
- Each four-photo API fixture used 10,486,051 stored bytes before deletion (10 MiB plus three 97-byte PNGs). The deployed system metadata confirmed the ownership marker. Author deletion blocked access immediately; cleanup removed the storage reference and file.
- The initial harness interruption after cleanup was an empty-CLI-result JSON parsing error. The cleanup function succeeded; the corrected full run passed all 51 checks. No backend cleanup failure was observed in these runs.

Synthetic profiles, posts, uploads, grants, sessions, challenges and moderation audit fixtures were removed. The temporary fixture functions were removed from source and the development deployment. Original release controls and moderator access were restored; photos remain disabled. The matching development authentication configuration remains available for subsequent testing. Restart the normal local web server to load the new ignored environment settings.

### Remaining release gates

Real wallet-extension and passkey-device login, registry onboarding and marketplace interactive smoke tests; physical iOS Safari/Android Chrome camera behavior; branded Safari and manual keyboard/screen-reader audit; full concurrency/interruption/account-switch acceptance; and Sprint 2's 10,000-post/50-user performance target remain pending. The synthetic timing samples above do not close operational monitoring or load acceptance. **Sprint 3 is not approved for general release.**
