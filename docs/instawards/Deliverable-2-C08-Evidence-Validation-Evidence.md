# Deliverable 2 C08 — Evidence validation

Date: 2026-10-14
Branch: `instawards/dev/sherwin`

## Scope and implementation

Reviewed the existing attachment, submission, revision, message, and deadline validation against Deliverable 2 C08. Existing raw-count limits, first-seen deduplication, ownership checks, parent/work links, message/conversation matching, and pre-write validation remain covered by the existing C08 and C09 suites.

The remaining gap was previous-dispute message evidence: the validator checked the historical dispute's work links and the conversation's participants, but omitted the historical dispute's own participant fields. A same-work dispute with a conflicting client or freelancer could therefore be accepted as evidence if its conversation still listed the current participants.

`assertPreviousDisputeBelongsToWork` now also calls the existing normalized participant validator. The public API, schemas, indexes, and status models are unchanged.

## Verification

Four new public-mutation cases cover both client/freelancer conflicts on both micro-gigs/milestones. Each includes a valid unlinked attachment, checks rejection and unchanged side-effect document snapshots, then restores the matching participant and verifies successful message association.

- Before the fix, three new cases incorrectly succeeded; the first case hit a cold-start test timeout. After the fix all four pass.
- C08: **27 passed**; C08+C09: **36 passed**, including existing legacy optional-link and valid historical-dispute evidence.
- Full backend suite: **365 passed across 13 files**.
- Backend source and test TypeScript: passed.
- Scoped oxlint, oxfmt, and `git diff --check`: passed.
- Required `pnpm lint:fix` could not start because the installed pnpm launcher points to a missing executable. Verification used installed workspace binaries.

Evidence uses local `convex-test` execution. No Convex deployment target or deploy key is configured, so live push/verification was not performed under the deployment guard. Participant wallet arguments still do not prove signed wallet possession; this change validates evidence associations only.
