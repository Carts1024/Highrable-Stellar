# Deliverable 2 C22 — participant integration and accessibility

Verified locally on 2026-10-09. This work extends the real participant detail, action gate, composers, timeline, and marking-status composition. No production behavior, backend API/schema, or contract changes were needed.

Four distinct regressions in `dispute-participant-integration.test.tsx` cover:

- Access revoked and restored while a write is pending, with no duplicate submission.
- Wallet/case replacement preventing stale reads and rejected writes from contaminating a new context.
- Independent evidence/response errors and pending controls, associated accessible feedback, and focus/draft preservation while the timeline recovers.
- Saved-hash status updates retaining drafts without another transaction submission.

Query fixtures now use the generated participant result aliases. Existing action-session and marking suites supply permission-loading, invalid attachment, duplicate-submit, uncertain submission, and confirmed-bookkeeping recovery coverage; the existing real attachment component suite supplies keyboard/label tests.

## Verification

- `vitest run features/disputes features/attachments/components-accessibility.test.tsx`: 60 tests across 10 files passed.
- Integrated participant composition alone: 10 tests passed.
- Web `tsc --noEmit --incremental false`, scoped oxlint, and oxfmt checks passed.
- Repository lint/typecheck runs through the normal pre-commit hook.

Convex transport, wallet/Stellar operations, upload transport, and some UI primitives are mocked. These checks prove local component behavior and DOM form/accessibility semantics, not live uploads, browser end-to-end behavior, signed participant identity, or deployed contract execution. Backend access evidence remains separately tested by the existing Convex suites.
