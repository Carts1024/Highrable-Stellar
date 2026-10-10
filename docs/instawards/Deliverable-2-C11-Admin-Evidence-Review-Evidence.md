# Deliverable 2 C11 - Admin Evidence Review Evidence

This note records source-grounded, mocked local UI evidence for C11. Source code, generated Convex types, current configuration, and test output remain authoritative.

## Acceptance mapping

| Acceptance area | Verified behavior | Evidence |
| --- | --- | --- |
| Case evidence surface | Assigned-admin detail renders case-level attachments in a dedicated section before review controls, independently from the timeline. Names, types, uploaders, and available size/date metadata are shown. | `admin-dispute-detail-page.test.tsx`; real-gate integration coverage in `admin-protected-pages.integration.test.tsx` |
| Event evidence | Timeline attachments remain nested under their original events and use the same evidence renderer. | Detail evidence regression and real-gate integration tests |
| Missing and unavailable records | Referenced IDs are compared with returned records. Missing records, deleted/blocked records, null storage URLs, unsafe URLs, and other unusable records show `Evidence unavailable` without an opening action. Empty references show `No evidence attached.` | Detail evidence matrix tests |
| Safe opening links | Active storage URLs and valid HTTP/HTTPS external links open in a new tab with `noopener noreferrer` and descriptive `Open <name>` accessible names. | Detail and integration evidence tests; shared `isValidHttpUrl` helper |
| Manual refresh | `Refresh detail` reports `Refreshing...`, disables duplicate requests, performs only the protected GET, and replaces evidence/status with the server response. | Detail refresh regression test |
| Refresh failure handling | Refresh failures are fail-closed: 404 removes loaded content and links to the queue; 401/403 preserve protected access handling; network/5xx errors remain recoverable through Retry. | Detail refresh regressions and existing protected-page integration suite |
| Identity isolation | The real `AdminSessionGate` prevents old-wallet and disconnected detail evidence from returning after late responses. | Protected administrator integration suite |
| Queue regression | Existing status/on-chain filters forward the expected backend values, and returned queue statuses remain visible. | `admin-disputes-page.test.tsx` |
| Write/chain boundary | Evidence rendering and refresh issue no mutations and no Stellar calls. Existing assignment, review, settlement, badges, and filters remain unchanged. | Detail/integration request and Stellar-call assertions |

## Validation results

- `pnpm --filter web test features/admin` — passed: 7 files, 173 tests.
- `pnpm --filter web test` — passed: 23 files, 286 tests.
- `pnpm --filter web exec tsc --noEmit` — passed.
- Scoped `oxlint` on the five changed administrator files — passed with 0 warnings and 0 errors.
- Scoped `oxfmt --check` on the five changed administrator files — passed.
- `pnpm --filter web build` — passed with Next.js 16.1.6; all application routes generated successfully.

## Boundaries and limitations

- The protected HTTP responses, session gate, wallet identity, and Convex results are mocked in local Vitest/Testing Library tests. This is not live Convex or deployed-admin API verification.
- No backend, schema, generated Convex, contract, public API, deployment, external service, participant query, preview/download flow, or Stellar transaction changed.
- The UI does not hydrate full submissions, revisions, messages, or deadline records from related IDs; those contents remain outside C11.
- Storage links and external URLs were validated for rendering and protocol safety only. Their live availability, authorization, and content were not verified.
