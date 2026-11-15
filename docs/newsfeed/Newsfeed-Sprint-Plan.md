# Highrable Newsfeed — Sprint Delivery Plan

## Summary

Build a members-only community feed shared by freelancers and clients. **Newsfeed becomes the first navigation tab in both modes**, including mobile navigation.

Plan for **one developer across five two-week sprints**. This is an initial estimate with testing included; authentication and video compatibility are the largest schedule risks.

Sprint 1 implementation and acceptance evidence is tracked in [Sprint 1 — Execution and Acceptance](./Sprint-1-Execution-and-Acceptance.md).

Sprint 2 implementation and acceptance tracking is in [Sprint 2 — Execution and Acceptance](./Sprint-2-Execution-and-Acceptance.md).

Agreed product behavior:

- Require verified login and a completed, named profile.
- Support external wallets and passkey smart accounts.
- Show the author’s profile name and avatar, never a wallet-address fallback.
- Preserve the **Freelancer** or **Client** badge from publication time.
- Show the same community posts in both modes.
- Deliver text first, followed by photos, video, and native camera capture.

## Product and Technical Decisions

### Feed experience

- Add `/newsfeed` and authenticated post-detail links.
- Display newest posts first with cursor pagination, 20 posts per page.
- Show a “New posts available” prompt instead of moving content while someone reads.
- Composer shows “Posting as [name] · Freelancer/Client.” Switching mode updates this preview; publication captures the displayed mode.
- Support text up to 3,000 characters, likes, flat comments, author editing/deletion, reporting, and moderator removal.
- Comments show their author’s name and posting-mode badge.
- Use current profile names and avatars on historical content; preserve the original mode badge.
- Require profile completion when a name is missing. Use “Unavailable member” for unavailable authors, never their wallet address.
- Keep existing landing and login destinations; first-tab placement does not change the default landing page.

### Media release

- Allow text-only, media-only, or text-with-media posts.
- Limit each post to four photos, maximum 10 MB each, or one video, maximum 60 seconds and 25 MB.
- Initially accept JPEG, PNG, and WebP photos; MP4/H.264 videos. Explain unsupported formats before publication.
- Provide previews, removal before posting, upload progress, cancellation, and retry.
- Use native camera capture where supported, with file selection fallback.
- Videos play on user action. No autoplay or live streaming.

### Implementation boundaries

- Add a newsfeed feature slice and Convex domain; keep social activity off-chain.
- Create additive records for posts, comments, likes, media uploads, reports, and moderation actions. Index feed ordering, post comments, author ownership, and per-user likes.
- Feed interfaces cover paginated list/detail reads, post/comment creation and editing, explicit like/unlike, reporting, upload/finalization, and moderation.
- Derive authorship from verified sessions. Never accept a browser-provided name or wallet as proof of identity.
- Use a Next.js session-authenticated API boundary backed by server-authorized Convex operations. Keep server credentials out of browser code and reject direct unauthorized Convex calls.
- Authenticate media delivery on every request; do not expose permanent storage URLs. Convex documents that ordinary file URLs can be reused without authentication. [Source](https://docs.convex.dev/file-storage/serve-files)
- Reuse existing UI components where suitable, but keep feed media separate from job/dispute attachment permissions.

## Sprint Backlog

Each sprint allocates approximately eight development days and two days for testing, fixes, and documentation.

| Sprint | Stories and deliverables | Acceptance criteria |
| --- | --- | --- |
| **1 — Verified identity and access** | **NF-01:** External-wallet and passkey session support. **NF-02:** Session status, expiration, logout, and wallet-switch handling. **NF-03:** Protect profile-name updates used by the feed. **NF-04:** Protected route and first-tab navigation behind a release flag. | Both login methods resolve to the correct profile. Forged wallet arguments and expired sessions fail. Guests receive no feed data. Disconnect clears cached feed content. Tab is first in both desktop/mobile mode menus only for eligible signed-in users. |
| **2 — Text community feed** | **NF-05:** Post composer, list, detail, edit/delete. **NF-06:** Names, avatars, immutable mode badges. **NF-07:** Likes and paginated comments. **NF-08:** Reports and basic moderator queue with hide/restore actions and audit records. | A freelancer post appears to clients and vice versa. Mode switching does not change existing badges. Only authors edit their content. Duplicate retries do not create duplicate posts or likes. Hidden/deleted posts disappear from lists and detail access. **Text beta release.** |
| **3 — Photos and camera capture** | **NF-09:** Validated photo upload and previews. **NF-10:** Native photo capture and upload fallback. **NF-11:** Protected media reads, upload ownership, orphan cleanup, and accessibility descriptions. | Four-photo and size limits enforced server-side. Users cannot attach another user’s upload. Guest media requests fail. Cancelled uploads are cleaned up. Failed uploads preserve draft text. **Photo release.** |
| **4 — Bounded video** | **NF-12:** Video upload, native capture, preview, duration/format validation. **NF-13:** Protected playback with seeking/range support. **NF-14:** Failure recovery and cross-browser verification. | Supported videos play and seek on target browsers. Oversized, too-long, or incompatible files receive clear errors. Media remains inaccessible after post removal. Camera cancellation returns safely to the composer. **Video release.** |
| **5 — Launch hardening and convenience** | **NF-15:** Saved posts and authenticated copy-link sharing. **NF-16:** Per-user posting/comment/upload rate limits and quotas. **NF-17:** Performance, accessibility, regression checks, operational monitoring, and release documentation. | Saved posts remain private to the saving user. Shared links require login. Load targets pass. Moderators can review reports and remove content. **General release.** |

Basic rate limits must accompany each earlier release; Sprint 5 tunes them using beta evidence.

Defer ranked recommendations, follows, reactions beyond Like, nested replies, notifications, reposts, stories, live streaming, and in-browser video editing to a later backlog.

## Bottlenecks and Mitigations

| Bottleneck | Repository evidence or risk | Planned response |
| --- | --- | --- |
| **Identity spoofing — launch blocker** | Profile mutations contain TODOs about trusting supplied wallet addresses; upload issuance also accepts wallet arguments. | Establish verified sessions and protect identity writes before publishing the feed. Audit shared endpoints for ways to bypass feed controls. |
| **Passkey authentication — schedule risk** | Current wallet identity includes passkey accounts, while the inspected session verification flow verifies Stellar message signatures. | Implement verified passkey-to-account binding and challenge validation in Sprint 1. Persist single-use challenges; do not rely on process-local replay tracking. |
| **Private media delivery** | Standard storage URLs are bearer links. Existing attachments lack a feed parent/access category. | Dedicated authenticated media path, ownership checks, private caching, and removal enforcement. Test download and video-range requests separately. |
| **Video compatibility and bandwidth** | Native camera formats vary; unrestricted video increases processing and delivery costs. | Keep bounded formats and limits. Reject unsupported captures clearly. Defer transcoding and longer video. |
| **Feed growth** | Unbounded reads, per-card profile queries, and loading every comment will increase latency. | Indexed pagination, bounded author hydration, stored aggregate counts, lazy media, and separately paginated comments. |
| **Abuse and storage growth** | Posting and uploads create spam, moderation, and abandoned-file workloads. | Reports, moderator controls, per-user quotas, upload expiration, and scheduled cleanup from the relevant release. |
| **Solo delivery capacity** | Authentication, media, UI, and QA share one owner. | Release incrementally; re-estimate after Sprint 1. Do not compress the security gate to preserve a date. |

## Validation, Release, and Defaults

- **Authorization:** Test guest access, session expiration, logout, account switching, forged identities, direct backend calls, other-user edits, and both sign-in methods.
- **Identity/modes:** Test cross-mode visibility, mode changes during drafting, unchanged historical badges, renamed profiles, and missing names.
- **Interactions:** Test concurrent likes, repeat submissions, pagination during new posts, deleted content, and moderation.
- **Media:** Test permission denial, unsupported capture, interrupted upload, spoofed metadata, limits, unauthorized storage association, protected playback, and cleanup.
- **Performance target:** With 10,000 seeded posts and 50 concurrent beta users, target p95 feed API response below one second and usable first-page content within 2.5 seconds on a documented mobile test profile. Treat these as acceptance targets, not measured results.
- **Checks:** Run relevant frontend/backend tests, type checks, lint, and production build. Verify navigation, onboarding, profiles, and marketplace flows remain functional.
- **Rollout:** Use separate text/photo/video release flags. Follow the existing CI-gated deployment workflow, deploy additive backend changes before consumers, and retain flags for rollback.
- **Monitoring:** Track feed latency, authentication failures, upload failures, storage consumption, playback errors, and moderation queue age without logging post contents or credentials.
- **Documentation:** Record sprint acceptance evidence and operational limits. Update relevant vault notes if restored; `docs/obsidian/` was absent from this checkout.

Dates remain relative until a start date is chosen. No paid video service, smart-contract changes, or public guest feed is assumed.

### Sprint 3 implementation and release gate

See [Sprint 3 — Execution and Acceptance](Sprint-3-Execution-and-Acceptance.md) for photo configuration, limits, implementation details, test evidence, pending device/deployment checks, monitoring and rollback. Keep photos disabled until the recorded acceptance gates pass.

### Sprint 4 implementation and release gate

See [Sprint 4 — Execution and Acceptance](Sprint-4-Execution-and-Acceptance.md) for video configuration, format limits, implementation details, test evidence, pending device/deployment checks, monitoring and rollback. Keep video disabled until the recorded acceptance gates pass.

## Sprint 5 — Launch Hardening and Convenience

Sprint 5 is an additive hardening and convenience sprint. It does not change Stellar contracts, introduce public guest content, add a paid media service, or expand the social model beyond post saves and authenticated links. It starts only after the Sprint 1–4 acceptance gates have been recorded. The text, photo, and video flags remain independently reversible throughout the sprint and after general release.

### Release configuration and ownership

Keep the existing flags and add two narrowly scoped convenience flags:

| Flag | Default | Enabled behavior | Rollback |
| --- | --- | --- | --- |
| `NEWSFEED_ENABLED` | `false` | Enables the protected Newsfeed shell and server boundary. | Set to `false` to withdraw Newsfeed completely. |
| `NEWSFEED_TEXT_ENABLED` | `false` | Enables feed, detail, comments, likes, reports, saves, and authenticated links when the parent flag is enabled. | Set to `false` to stop all Newsfeed text operations. |
| `NEWSFEED_PHOTOS_ENABLED` | `false` | Enables photo reservations, transfer, protected reads, and photo UI. | Set to `false`; retain records and cleanup. |
| `NEWSFEED_VIDEO_ENABLED` | `false` | Enables bounded video reservations, transfer, protected range reads, and video UI. | Set to `false`; retain records and cleanup. |
| `NEWSFEED_SAVED_ENABLED` | `false` | Enables save/unsave controls and the authenticated saved-post list. | Set to `false`; hide controls/list and fail save writes closed. |
| `NEWSFEED_SHARING_ENABLED` | `false` | Enables authenticated copy-link controls. | Set to `false`; hide controls. Existing links remain login-gated. |

The convenience flags are subordinate to `NEWSFEED_ENABLED` and `NEWSFEED_TEXT_ENABLED`. The Convex deployment and Next.js environment must agree before a flag is considered enabled. A flag change is a release-control action, not a schema rollback. Additive tables, counters, protected-media routes, and cleanup continue running after a rollback.

### NF-15 — Private saved posts

#### Data model and server contract

Add `newsfeedSavedPosts` to the Convex schema with:

- `userId: Id<"users">`, `postId: Id<"newsfeedPosts">`, and `createdAt: number`.
- `by_user_createdAt` on `[userId, createdAt]` for newest-first per-user cursor pagination.
- `by_user_post` on `[userId, postId]` as the uniqueness key. The save mutation must perform the lookup and insert/delete in one Convex transaction; duplicate `saved: true` requests cannot create a second row.
- `by_post` on `[postId]` only if it is needed for bounded cleanup or operational inspection. It must never be used to expose a save count.

The row is private application state. There is no public saved count, author-facing save list, or cross-user lookup. A moderation hide does not delete the row, so restore preserves the member’s intent; the saved query simply filters the hidden post. Author deletion is likewise filtered immediately. If a post record is ever physically purged, its saved rows are removed in the same maintenance operation without producing a user-visible distinction.

Expose the following through the existing authenticated Next.js-to-Convex boundary only:

- `POST /api/newsfeed/posts/[postId]/save` with `{ "saved": boolean }`, returning `{ "saved": boolean }`.
- `GET /api/newsfeed/saved?cursor=...`, returning the standard `{ items, cursor, hasMore }` cursor page of `TNewsfeedPostDto` objects.
- `TNewsfeedPostDto.viewer.saved: boolean`, calculated from the verified actor’s `userId` for every visible post and never from a browser-supplied wallet or profile.
- An authenticated `/newsfeed/saved` view that reuses the normal post card/detail components. It shows only the current member’s saved posts and has the same protected media behavior as `/newsfeed`.

Save and unsave are idempotent: repeating the same state returns success without changing the result. A missing, author-deleted, or moderation-hidden post returns the same generic `404 Post is unavailable` response as an unknown post for both read and write paths. The saved list skips those rows and does not reveal whether a hidden/deleted post was previously saved. A guest receives `401` and no saved row or post DTO.

The feed card and detail page each include a labeled save button with `aria-pressed`, `aria-busy`, disabled pending state, and a `role="status"` success message. The client may update the icon optimistically, but must restore the previous state on failure and expose an inline retryable error. A `429` error must include the server retry time rather than triggering an automatic retry. Logout, session expiry, and account switching abort in-flight requests and clear saved-list and post caches before rendering the next account.

#### Saved-post acceptance

- Save and unsave the same post repeatedly, including two concurrent saves, without duplicate rows or count changes.
- Confirm user A cannot read, mutate, infer, or paginate user B’s saved rows by changing a post ID, cursor, wallet argument, or direct Convex request.
- Confirm `viewer.saved` is true only for the authenticated saver, is false after unsave, and is recalculated after account switching.
- Hide and restore a post, author-delete a post, revoke the session, and retry stale cursors; no hidden/deleted post or existence signal reaches the member.
- Verify keyboard focus, screen-reader names, pending/error recovery, responsive layout, and saved-list empty/loading/error states.

### NF-15 — Authenticated copy-link sharing

The only share destination is the canonical same-origin path `/newsfeed/[postId]`. Build it from the validated post ID and current origin; never share a storage URL, API URL, session credential, query-string token, post text, or wallet address. A card and detail page show a `Copy link` control when `NEWSFEED_SHARING_ENABLED` is active.

The client attempts `navigator.share({ title, text, url })` when Web Share is available. The title is generic (`Highrable Newsfeed post`) and the text is generic (`View this post in Highrable Newsfeed`); no post content is sent to the share sheet. A user cancellation (`AbortError`) returns to the unchanged page without an error. When Web Share is unavailable, the client uses `navigator.clipboard.writeText(canonicalUrl)`. Clipboard success produces an accessible live confirmation; clipboard denial/unavailability produces an inline error with a retry action and never silently falls back to a public URL.

The detail route and post API remain members-only. A guest who opens a copied link sees the existing login gate; the server must not fetch or serialize post content, author metadata, media metadata, Open Graph data, structured post data, or protected media before authentication. The login/onboarding destination is the validated relative path `/newsfeed/[postId]`, encoded as the existing `next` value. After successful authentication, the app returns to that exact post and performs a fresh authorized fetch. Reject absolute or cross-origin `next` values. A logout or account switch while viewing the link clears the old post and media state before resolving access for the new account.

Share telemetry is privacy-safe: record only method (`web_share` or `clipboard`), outcome (`success`, `cancelled`, or categorized failure), flag state, route family, and duration. Do not send the canonical URL, post ID, post content, metadata, wallet, session, or clipboard contents to analytics or logs.

### NF-16 — Rate limits, daily quotas, and abuse behavior

Preserve these server-side per-user rolling one-minute limits:

| Operation | Per minute | Daily launch quota | Counter event |
| --- | ---: | ---: | --- |
| Posts | 5 | 50 | Accepted post publication only |
| Comments | 20 | 200 | Accepted comment creation only |
| Likes | 60 | — | Accepted like/unlike mutation |
| Reports | 10 | — | Accepted report creation; an idempotent open-report retry does not consume another slot |
| Upload reservations | 10 | 40 | Accepted reservation; cancelled/expired reservations still count for the UTC day |

Retain the eight-active-unattached-upload limit and the four-photo/one-video post limits. The post media invariant remains atomic: a post cannot contain both photos and video, and invalid media never consumes a publication quota because no write is committed.

Persist daily counters in a `newsfeedDailyQuotas` table (or an equivalent server-side counter component) with `userId`, operation (`post`, `comment`, or `upload`), UTC `periodStart`, `count`, and `updatedAt`, indexed by `[userId, operation, periodStart]`. The current `newsfeedRateLimitWindows` table remains the minute-window source of truth. All checks and counter increments occur in the same authenticated Convex mutation as the business write/reservation. Convex transaction conflict/retry behavior and a concurrent test must prove that a user cannot pass the same limit twice through racing requests. The server obtains the actor from the verified session after checking the service boundary; browser-supplied wallet, name, role, and quota values are ignored.

Request deduplication runs before consuming a post/comment/report quota. Replaying an identical accepted request returns its original result and does not consume another slot; reusing a request ID with a different payload returns `409`. Upload reservations receive a request ID for the same retry rule. A failed validation, failed authorization, or aborted transaction does not increment a counter.

Limit failures are `429 Too Many Requests` with all of the following:

- `Retry-After` in whole seconds.
- `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`, and `X-RateLimit-Reset` as a Unix timestamp.
- JSON `{ "error": "Rate limit exceeded.", "code": "RATE_LIMIT", "operation": "post|comment|like|report|upload", "scope": "minute|day", "retryAt": <unix-ms>, "retryAfterSeconds": <integer> }`.

The web error boundary preserves these fields for accessible UI messaging. A counter never includes post content, credentials, filenames, raw wallet addresses, seed phrases, or private keys. Emit a privacy-safe `newsfeed_limit_rejected` event with operation, scope, limit, retry duration, route family, and deployment only.

### NF-17 — Hardening, performance, and accessibility

#### Security and regression matrix

Before enabling general release, run the full matrix against a deployed release candidate using both an external wallet and a passkey smart account:

- Guest, expired-session, revoked-session, logout, account-switch, incomplete-profile, forged-wallet, forged-profile, forged-mode, and direct-Convex/service-secret requests.
- Duplicate post/comment/upload/save/share interactions, conflicting request IDs, concurrent quota-bound writes, cursor reuse, and refresh during a new-post prompt.
- Other-user edit/delete/save/unsave/report attempts, moderation hide/restore/dismiss, author deletion, moderator-only media reads, protected media revocation, range playback after removal, and orphan cleanup.
- Photo/video exact limits, unsupported and spoofed metadata, eight active reservations, failed transfer recovery, camera permission denial/cancellation, and retry without losing draft text.
- Navigation, onboarding, profile/avatar, marketplace, authentication, logout, and account-switch regressions with each Newsfeed flag combination.

#### Performance scenario and pass/fail criteria

Use a repeatable seeded scenario of 10,000 visible posts, 20-item pages, realistic author/avatar hydration, and representative text/photo/video metadata. Run 50 concurrent authenticated beta users for at least 15 minutes after a warm-up, with a documented mix of first-page loads, cursor loads, detail/comments reads, and update checks. Capture server duration, total API duration, error rate, and browser timing separately; do not count protected media bytes as feed API time, but measure lazy media and range playback in a separate panel.

The launch profile is a mid-tier mobile Chrome profile (Pixel-class viewport, 4× CPU throttle, 150 ms RTT, constrained 4G) with an already established authenticated session. “Usable first-page content” means the Newsfeed heading plus the first post’s author, badge, timestamp, text, and reserved media area are visible; it does not require every image/video byte to finish. Pass only when p95 feed API latency is below **1,000 ms**, usable first-page content is visible within **2.5 seconds**, and the run has no authorization leak, duplicate write, or unbounded-query failure. Record the seed, profile, concurrency, flag state, build SHA, p50/p95/p99, error rate, and raw run artifact. A target is not a result; general release remains blocked until measurements are recorded.

#### Accessibility and responsive audit

- Complete every feed, saved-list, detail, composer, save, share, report, comment, upload, playback, edit, delete, and moderation action with keyboard only. Focus order must follow visual order, focus must remain visible, dialogs must trap/restore focus, and no action may require pointer hover.
- Give save/share/upload/playback controls stable accessible names and pressed/busy states. Announce pending, success, rate-limit, and recoverable-error transitions with `role="status"` or `role="alert"` without duplicating the message for screen readers.
- Run a screen-reader pass with VoiceOver/Safari and NVDA/Chrome; include TalkBack/Android Chrome in the deployed device pass. Verify post author, immutable mode badge, media description, duration, playback controls, pagination, empty states, and hidden/deleted unavailable states.
- Honor `prefers-reduced-motion`; do not autoplay video or use motion-only feedback. Test contrast, text resizing to 200%, zoom, touch target size, and 320 px, 375 px, tablet, and desktop widths. Verify media controls and range playback remain usable in portrait and landscape.

### Tests and evidence required

Backend coverage must include saved-post uniqueness/idempotency, private ownership, cursor pagination, hidden/deleted filtering, `viewer.saved`, duplicate request behavior, exact minute/day boundaries, UTC reset, `429` metadata, concurrent enforcement, eight-active-upload enforcement, four-photo/one-video rules, moderation visibility, media revocation, and cleanup. Frontend coverage must include card/detail save state, saved-list loading and account isolation, pending/error/retry behavior, Web Share success/cancel, clipboard fallback and failure, validated login redirect, keyboard/focus states, reduced motion, and cache clearing on logout/account switch.

Run and record, at minimum:

```text
pnpm --filter @repo/backend test
pnpm --filter @repo/backend typecheck
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter @repo/backend lint:check
pnpm --filter web lint:check
pnpm --filter web build
pnpm build
```

The existing marketplace, onboarding, profile, wallet, authentication, and deployment checks must remain green. Test results, performance artifacts, browser/device matrix, flag state, and environment names may be recorded; never record post contents, credentials, filenames, session IDs, wallet secrets, or seed phrases.

### Operational readiness

Create a dashboard or retain documented log queries for these privacy-safe event families:

| Signal | Required fields | Initial launch alert/target |
| --- | --- | --- |
| Feed latency and errors | route family, page type, duration, status class, page size, flag state | p95 API under 1 s; alert after 5 minutes above 1 s or 5xx above 2% |
| Authentication failures | route family, failure class, status, flag state | alert on a sustained 2× baseline or any cross-account authorization failure |
| Save/share failures | operation, method, outcome, error class, duration, flag state | alert above 5% for 10 minutes; no post IDs or URLs |
| Rate-limit/quota responses | operation, scope, limit, retry duration, route family | alert on a 2× beta baseline or unexpected operations being limited |
| Upload/playback failures | kind, phase, status/error class, duration, bytes/range class | alert above 5% for 10 minutes; preserve current upload/playback baselines |
| Storage and cleanup | scanned/deleted records, bytes, oldest backlog age, cron outcome | alert above 80% storage or cleanup backlog older than 24 hours |
| Moderation queue | open count, oldest age, action outcome | page the moderator owner when the oldest open report exceeds 24 hours |

Use event names such as `newsfeed_feed_read`, `newsfeed_auth_failure`, `newsfeed_save`, `newsfeed_share`, `newsfeed_limit_rejected`, `newsfeed_media_upload`, `newsfeed_media_read`, `newsfeed_cleanup`, and `newsfeed_moderation`. Fields are bounded enums, counts, durations, sizes, status classes, and flag/build identifiers. Hash or omit actor identifiers; never log post/comment text, media bytes, filenames, storage URLs, session credentials, wallet addresses, or secrets. The dashboard must separate synthetic acceptance traffic from real beta traffic.

#### Moderator procedure

1. Open the report queue, verify the target and report reason, and inspect hidden media only through the moderator-protected route.
2. For a policy violation, hide the post/comment with a reason; verify it disappears from feed, detail, saved results, and member media reads. For a false report, dismiss it. Restore only after review confirms the content is allowed.
3. Treat author deletion as terminal; do not restore it through moderation. Confirm the audit action, visibility, media revocation, and cleanup state. Escalate queue-age or repeated abuse incidents using the incident runbook.

#### Incident and rollback procedure

1. Record the incident start time, build SHA, active flags, affected route family, error/latency evidence, and moderator/owner. Do not copy user content or secrets into the incident record.
2. For a privacy/authentication or media-access incident, immediately disable `NEWSFEED_SAVED_ENABLED`/`NEWSFEED_SHARING_ENABLED` or the affected photo/video/text parent flag in Convex and the web environment. If the boundary is uncertain, disable `NEWSFEED_ENABLED`; protected media grants still expire and cleanup continues.
3. For quota or abuse incidents, leave reads available when safe, reduce the server-side limits only through a documented constant/configuration change, or disable publishing/uploads. Never trust a client-side limit and never delete counters to “reset” abuse.
4. Preserve additive schema, moderation actions, saved associations, media-revocation checks, and cleanup code. Do not roll back to a build that exposes ordinary storage URLs or bypasses verified sessions. Re-enable one flag at a time after a deployed smoke test and compare the dashboard with the pre-incident baseline.

General release is approved only when all Sprint 1–4 gates are recorded, the operational dashboard/log queries and baseline thresholds exist, the performance and accessibility evidence passes, moderator procedures have an owner, rollback flags have been tested, and `NEWSFEED_TEXT_ENABLED`, `NEWSFEED_PHOTOS_ENABLED`, and `NEWSFEED_VIDEO_ENABLED` are intentionally enabled. Saved/share flags must also be explicitly recorded as enabled or deferred; they must never become active by an environment default.

Dates remain relative until a start date is chosen. The recommended sequence is: days 1–2 schema/API and quota design; days 3–4 saved UI and link sharing; days 5–6 quota/error contracts and abuse tests; days 7–8 performance/accessibility and regression checks; days 9–10 deployed acceptance, dashboards, moderator rehearsal, rollback rehearsal, and release sign-off.
