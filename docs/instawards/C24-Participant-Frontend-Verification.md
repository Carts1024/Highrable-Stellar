# C24 Participant Frontend Verification

The participant work for Deliverable 1 is on `instawards/dev/sherwin`. This verification maps the six Frontend Developer 2 commits from the sprint plan. Source code and test results are authoritative.

| Sprint ID | Commit | Evidence |
| --- | --- | --- |
| C07 | `d18bea6` | Participant routes and wallet-scoped list/detail state coverage |
| C11 | `bea0955` | Open dispute validation and creation flow coverage |
| C15 | `d90672d` | Participant timeline, detail, and state coverage |
| C19 | `dc1d340` | Evidence and response actions with attachment validation and retry coverage |
| C23 | `2e2656e` | On-chain marking, transaction links, failure and recovery states |
| C24 | This verification commit | Integrated detail/actions/timeline and attachment accessibility regression coverage |

## C24 checks

- `dispute-participant-integration.test.tsx` renders the real detail panel, participant action gate, composers, and timeline together. It checks viewer-scoped reads, labeled text fields, timeline list naming, evidence and response form submission, error association, and closed-case action suppression. The opening-dialog suite also checks native form submission.
- `components-accessibility.test.tsx` renders two real attachment uploaders to check unique URL and protection-toggle label targets. It checks Enter and Space on the upload target and verifies disabled keyboard/click behavior.
- The opening and composer forms use native submit buttons so keyboard activation follows browser form behavior. Validation errors are announced and associated with their forms; message-field errors are associated with their text areas. The timeline list has an accessible name.

## Verification commands

From `apps/web`, run `pnpm test` and `pnpm exec tsc --noEmit`. The C24 run passed **204 tests in 20 files**. The web TypeScript check, Next route type generation, and focused lint check passed. The local `pnpm` launcher failed to start, so these checks ran through the installed `vitest`, `tsc`, `next`, `oxlint`, and `oxfmt` binaries. The repository's existing test run prints missing local WalletConnect and development session-secret notices; neither is a test failure.

## PR status

GitHub PRs [#65](https://github.com/Carts1024/Highrable-Stellar/pull/65) and [#72](https://github.com/Carts1024/Highrable-Stellar/pull/72) for this branch are merged. They predate C19, C23, and C24. A new PR containing the later commits has not been created as part of this local commit; the six-commit mapping above is the handoff evidence for its description.
