# Deliverable 2 C24 — participant acceptance and final handoff

Verified locally on 2026-10-09 on `instawards/dev/sherwin`.

## Acceptance journey and correction

`dispute-participant-integration.test.tsx` now exercises an unrelated wallet's denied case access, permitted evidence/response writes with associated timeline updates, and a saved case's uncertain marking attempt. The real detail coordinator saves the signed hash, preserves the case and draft after a submission timeout, blocks a second transaction, recovers a failed timeline read, and consumes authoritative confirmed status for the same hash.

The journey reproduced a real inconsistency: confirmed marking displayed alongside the obsolete `Transaction outcome is uncertain` alert. `dispute-marking-status.tsx` suppresses only that superseded pending-outcome error when status is `marked`. A separate regression proves that a confirmed transaction with unfinished parent bookkeeping still shows its error and recording retry, without another Stellar submission.

Existing opening-dialog regressions cover saved/uncertain case recovery without duplicate case creation. The new composition tests reuse the production forms, action gate, timeline, and marking coordinator rather than adding a second state machine.

## Evidence across layers

| Boundary | Evidence |
| --- | --- |
| Participant UI acceptance | New C24 journey and marked-with-bookkeeping-failure test in `dispute-participant-integration.test.tsx` |
| No duplicate saved-case creation | Existing `open-dispute-dialog.test.tsx` saved-case and uncertain-submission cases |
| Real backend permission/evidence checks | `c19.participant-evidence.test.ts` permitted/denied actors and protected reads; `c08.evidence.test.ts` terminal rejection and unchanged graph |
| Real backend marking recovery | `c13.idempotency.test.ts` and `c14.marking.test.ts` known-hash retry blocking, matching success, and replay behavior |
| Actual server recovery boundary | `core/admin/settlement-recovery.test.ts`, using real route/SDK verification with mocked RPC and Convex transport |

UI Convex subscriptions/mutations, wallet/Stellar transport, upload transport, and some primitives are mocked. The backend tests execute real domain functions locally. These linked checks do not prove live browser-to-chain execution, deployed source identity, or private-key possession for public wallet arguments.

## Final validation

- Full web suite: **346 passing tests across 24 files**.
- Full backend suite: **361 passing tests across 13 files**.
- Deployment verifier: **49 passing tests**, including real SDK decoding against a loopback RPC server.
- Participant plus attachment checks: **62 passing tests across 10 files**; administrator checks: **200 passing tests across 7 files** (included in web totals).
- Web TypeScript and scoped formatting/lint checks pass. Repository lint/typecheck also runs in the commit hook.
- Canonical `next build`: compilation and TypeScript passed, but page-data collection failed because the pre-existing local `.env` supplies blank contract IDs, hashes, and optional server settings rejected by production validation. The environment file was not edited. Environment-free source-copy checks were also blocked by Turbopack junction restrictions and Windows/webpack source-path handling. **A complete production build is not verified.** No build artifact is presented as deployable.

## Chronological commit map

| Deliverable | Commit | Result |
| --- | --- | --- |
| D2 C19 | `cc779dd` | Existing implementation retained; focused checks revalidated |
| D2 C20 | `e742265` | Read-only deployment verifier and local tests; real build/live identity evidence unavailable |
| D2 C21 | `efffc4b` | Administrator integration coverage and stale-wallet settlement guard fix |
| D2 C22 | `b974d56` | Participant integration/accessibility regressions |
| D2 C23 | `e3f8c5b` | Protected administrator acceptance journey |
| D2 C24 | Commit containing this report | Participant acceptance and obsolete uncertainty feedback correction |

All new commits are local on the requested branch. No new branch, Git worktree, push, PR, deployment, or transaction submission was performed. Temporary agent source copies had no independent Git history; only the coordinator integrated and committed.

Live C20 verification remains blocked on matching backend scope and actual tested production WASM. Local verifier implementation and UI/backend acceptance work are complete within the agreed scope. This does not claim completion of every four-week SOW or every Deliverable 2 sprint exit criterion.

The required lint/typecheck workflow passed manually before C20. The previously absent local Husky hook was initialized for C21–C24 and ran successfully on those commits; the original local Git hook-path configuration is restored after the last commit. The temporary pnpm wrapper and agent copies are tooling artifacts outside tracked source, not project dependency or configuration changes.
