# Sprint 4 — Execution and Acceptance

## Scope

Sprint 4 adds bounded video to the existing protected newsfeed media lifecycle. The implementation is additive and keeps the release disabled until the inherited authentication gates, deployed streaming checks, and physical-device checks pass.

## Configuration

Video is enabled only when all three Convex/web flags are true:

- `NEWSFEED_ENABLED=true`
- `NEWSFEED_TEXT_ENABLED=true`
- `NEWSFEED_VIDEO_ENABLED=true`

The web server also requires `NEWSFEED_CONVEX_HTTP_URL` for the Convex HTTP origin. The flag defaults to false in both environment examples. Photos retain their independent `NEWSFEED_PHOTOS_ENABLED` flag.

## Format and lifecycle limits

- One video per post; photo/video mixtures are rejected atomically.
- MP4 container with one H.264/AVC video track and optional AAC-LC audio.
- Maximum size: **26,214,400 bytes**, inclusive.
- Maximum duration: **60 seconds**, inclusive by the validated sample timing.
- Validated dimensions, codecs, duration, sample offsets, and complete container structure are stored as additive metadata.
- Storage records without a `kind` remain photos for backward compatibility.
- Published DTOs expose only opaque media IDs, description, dimensions, and duration; storage IDs and URLs are never serialized.

## Implementation evidence

- `packages/backend/convex/newsfeed/decodeVideo.ts` uses pinned MP4Box.js parsing in a server-only action and rejects malformed, truncated, MOV/WebM, encrypted/unsupported codec, extra-track, invalid-sample, and duration-limit inputs with stable video error codes.
- `/newsfeed/videos` receives bytes directly in Convex, enforcing the byte limit while reading the stream. Next.js only handles reservation and metadata.
- `/api/newsfeed/media/[mediaId]` and its moderator equivalent authorize on every request and stream protected video through Next.js. Native playback uses `controls`, `playsInline`, `preload="none"`, and browser range requests.
- Convex delivery supports full responses, bounded/open-ended/suffix single ranges, and `416` unsatisfiable ranges. Malformed or multiple ranges receive the full representation.
- Cleanup, cancellation, deletion, moderation visibility, session ownership, and shared-storage protections use the existing newsfeed lifecycle.

## Automated checks

- Backend lifecycle tests cover one-video publication, description and kind enforcement, feature-flag failure, opaque DTOs, cleanup-compatible attachment, and full/ranged protected delivery.
- Video decoder tests cover empty, exact-over-limit, MOV, WebM, and truncated container rejection.
- Existing photo, text-feed, frontend, typecheck, and production behavior remain regression targets.

## Pending release gates

- [ ] Deployed exact 26,214,400-byte transfer and 60-second boundary verification.
- [ ] Deployed authenticated full/`HEAD`/range playback, revocation after hide/delete, and metadata-at-end seeking.
- [ ] Chrome, Firefox, desktop Safari, physical iOS Safari, and Android Chrome capture/playback evidence.
- [ ] Wallet/passkey, onboarding, logout/account-switch, and inherited Sprint 2 authentication acceptance.
- [ ] Operational baselines for validation/upload failures, playback failures, range latency, transferred bytes, cleanup backlog, and storage growth.

Until those checks are recorded, video remains disabled. Rollback is the additive configuration change `NEWSFEED_VIDEO_ENABLED=false`; photo and text operation remain available.
