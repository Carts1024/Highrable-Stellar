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
