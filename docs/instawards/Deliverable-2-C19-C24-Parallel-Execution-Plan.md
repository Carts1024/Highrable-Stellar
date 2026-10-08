# Deliverable 2 C19–C24 parallel execution plan

Status: local implementation and acceptance tests completed on 2026-10-09. Live C20 identity evidence remains unavailable as anticipated; the complete production build is blocked by local configuration/tooling. See `Deliverable-2-C24-Participant-Acceptance-Evidence.md` for final checks and the chronological commit map. Prepared on 2026-10-08.

## Scope and decisions

- Source requirements: `Highrable-Instawards-Deliverable-2-Sprint-Plan.md`, particularly Day 4, with the SOW and current implementation as supporting authority.
- Target branch: `instawards/dev/sherwin`. No new branches or Git worktrees, history rewriting, pushes, PRs, merges, deployments, or transaction submissions.
- The user's single-branch instructions override the sprint document's four-role-branch/PR workflow. Agent roles describe work ownership, not human Git attribution.
- Preserve existing C19 commit `cc779dd` (`fix(disputes): validate RPC records and settlement recovery (D2 C19)`). Audit and rerun focused verification; add a C19 correction only for a demonstrated gap, before C20.
- Commit remaining substantive work in order C20, C21, C22, C23, C24. Do not manufacture changes or duplicate tests to force five new commits.
- C20 implements and tests a local verifier. Attempt read-only Testnet verification only when the intended backend network/contract scope is available. Otherwise explicitly record live verification as blocked. Do not deploy to satisfy this gate.
- C21–C24 use automated local integration/acceptance coverage. Mocked transport and wallet seams must be named in evidence; this does not establish live end-to-end completion.
- Execution was authorized on 2026-10-09. This planning document is included with C20.

## Observed baseline

At inspection, HEAD was `cc779dd`, the target branch was already checked out, and the working tree was clean before this document was created. Recheck these facts at execution start.

Deliverable 1 C19–C24 already exist and must not be confused with these Deliverable 2 identifiers. Existing administrator and participant suites already cover many of the requested states. Each agent must map existing named tests before proposing new coverage.

Relevant starting points:

| Area | Existing sources and evidence |
| --- | --- |
| C19 backend/route recovery | `packages/backend/tests/disputes/c19.rpc-reconciliation.test.ts`, `apps/web/core/admin/settlement-recovery.test.ts`, `Deliverable-2-C19-RPC-Recovery-Evidence.md` |
| Deployment verification | `scripts/verify-testnet.sh`, `packages/backend/convex/lib/stellarReads.ts`, `apps/web/core/config/env.ts`, public deployment artifacts |
| Administrator integration | `apps/web/features/admin/admin-dispute-detail-page.test.tsx`, `admin-protected-pages.integration.test.tsx`, `lib/settlement-validation.test.ts`, `apps/web/app/api/admin/disputes/[disputeId]/resolve/route.ts` |
| Participant integration | `apps/web/features/disputes/components/dispute-participant-integration.test.tsx`, `dispute-participant-actions.test.tsx`, `dispute-marking-status.test.tsx`, `dispute-timeline.test.tsx` |
| Backend access/evidence | `packages/backend/tests/disputes/c08.evidence.test.ts`, `c19.participant-evidence.test.ts`, dispute permission and mutation helpers |

The existing verifier checks wiring through contract invocations, requires a signing identity, assumes `get_next_escrow_id == 1`, and does not compare deployed WASM identity to the tested build. It is not sufficient evidence for C20. Do not run it as an assumed read-only identity check.

The pre-commit hook runs `pnpm lint:fix`, which invokes broad autofixes and web type generation. Previous C19 evidence reports a broken local pnpm launcher. Execution must establish working commands and preserve hook behavior before the first commit; do not silently bypass hooks or claim an unsuccessful command passed.

## Agent model and conflict prevention

Use four active slots: one coordinator and three workers. The coordinator alone changes the canonical branch, index, commits, shared configuration, generated outputs, and shared documentation.

Workers implement and test in coordinator-created, temporary **non-Git source copies** of the same verified baseline. These are ordinary temporary directories, not branches or Git worktrees; they have no independent history. Copy tracked source without secrets or local environment files. Give each worker its own writable source and build/test output directories. Reuse installed dependency caches only where safe; do not share mutable build output. Do not introduce dependencies merely to make parallel execution possible.

Each worker returns a patch bundle or changed-file bundle, its base revision, exact owned paths, requirement-to-test mapping, commands/results, and limitations. Worker Git mutations, staging, commits, deployment, and edits to the canonical checkout are prohibited. This isolates unfinished later deliverables from both earlier commits and repository-wide formatting hooks.

| Owner | Deliverables | Allowed primary files | Dependencies |
| --- | --- | --- | --- |
| Coordinator | C19 audit, integration, shared fixes, evidence | Canonical checkout; backend/server boundaries; root configuration; plan and vault notes | Owns frozen API/status contract |
| Worker A — deployment | C20 | Agreed verification script/helper and dedicated verifier tests | Backend network/contract configuration; tested local WASM |
| Worker B — administrator | C21, then C23 | `apps/web/features/admin/` and assigned administrator test files | C19 recovery contract; C21 committed before C23 implementation |
| Worker C — participant | C22, then C24 | `apps/web/features/disputes/` and assigned participant test files | Existing permission/marking contract; C22 committed before C24 implementation |

Before dispatch, replace directory-level ownership with a concrete file list. Shared `core/admin`, `core/stellar`, attachment primitives, backend helpers, manifests, lockfiles, Vitest configuration, and vault files require coordinator ownership. A worker reports needed shared changes instead of editing them opportunistically. Transfer ownership explicitly if inspection proves another assignment is better.

If temporary execution environments cannot be made reliable, workers can prepare patches in source copies while the coordinator runs authoritative checks after integration. Report worker checks as pending in that case. Do not fall back to concurrent edits in the canonical checkout.

## Stage 0 — baseline and interface freeze

1. Recheck branch, HEAD, index, and working tree. Identify the planning document separately from any new user work. Never stash, reset, overwrite, or commit unrelated changes automatically.
2. Read `AGENTS.md`, `GEMINI.md`, vault Home/Repository Map, and relevant domain notes. Read applicable skills when implementation reaches their domains.
3. Map C19–C24 acceptance criteria to source and existing tests. Record proven coverage, genuine gaps, and unavailable evidence separately.
4. Verify installed pnpm, Node, test runners, Rust, Stellar CLI, and build availability without upgrading project dependencies. Resolve launcher problems if possible; otherwise report a commit-hook blocker while continuing independent work.
5. Audit C19 and run its focused backend and web recovery suites. Freeze callback arguments, permission results, status vocabulary, settlement phases, and known-hash recovery rules from current source.
6. If C19 needs correction, implement and verify it first and create a focused D2 C19 correction commit. Create worker baselines after that correction, so later agents do not build against a stale interface.

Gate: C19 is verified or its material blocker is explicit; worker source baseline and file ownership are recorded.

## Stage 1 — parallel C20, C21, and C22

### C20: repeatable deployment identity verification

Implement an explicit, read-only verification command compatible with installed tooling. Preserve existing post-deployment wiring verification where still useful; do not conflate a fresh-deployment assertion with identity verification of an active deployment.

Required inputs and output:

- Explicit intended backend network/passphrase, RPC endpoint, escrow contract ID, and relevant linked contract identity. Public artifact defaults are candidates, not proof of active backend configuration.
- Local build provenance: tested source revision, toolchain/build mode, and freshly built WASM hash. Include relevant uncommitted source state if applicable; do not label it a clean revision build.
- Remote network identity and deployed contract executable/code hash, compared with the selected local WASM. If optimization changes bytes, use the actual deployment build pipeline.
- Clear results for matched, mismatched, unreadable, or missing configuration, with nonzero failure/unknown exit behavior and a concise machine-readable record where practical.
- No signing identity, submission, deployment, or automatic rewrite of deployment records. Never print secrets or authenticated RPC URL credentials.

Tests must cover a matching identity, wrong network/contract/code, absent contract, malformed/unavailable RPC data, and missing local build/input. Assert verification cannot submit transactions. An active deployment with an escrow counter greater than one must not fail merely for being used.

Completion: local verifier and failure paths pass. Live result is recorded separately as verified, mismatch, unavailable, or blocked; local tests never produce a live-match claim.

### C21: administrator resolution integration coverage

Extend existing tests only where a distinct gap remains. Exercise real administrator components and settlement coordination with typed backend/API fixtures and controlled external seams.

Required boundaries:

- Unauthorized, unassigned, revoked, or stale-session actions cannot progress to settlement.
- Client refund, freelancer payout, valid split, and invalid basis-point values follow the existing contract.
- Preparation/signing/submission/confirmation/final-recording states remain distinct; duplicate clicks do not duplicate execution.
- Simulation/signing rejection and verified failure permit only the existing safe retry path.
- Saved-hash, unknown, or pending outcomes require recovery; recovery never resubmits the saved transaction.
- Success is displayed only after the trusted settlement result and required bookkeeping, with read-refresh failure distinguished from settlement failure.

Completion: focused coverage proves the UI's consumption of the backend contract. Shared route/backend fixes, if needed, are separately owned and integrated by the coordinator in this deliverable.

### C22: participant integration and accessibility coverage

Reuse the real detail/action/form/timeline composition and typed query/mutation fixtures. Preserve existing draft session isolation.

Required boundaries:

- Denied/revoked case access and wallet/case changes remove protected content and reject stale results.
- Evidence/response validation, permission loading, pending writes, duplicate submission, rejected-write recovery, and independent drafts follow backend results.
- Timeline loading/errors can recover without duplicate writes or losing same-case drafts.
- Marking pending, failed, saved-hash, uncertain, and confirmed states show correct recovery and transaction links.
- Forms have associated labels/errors, announced feedback, meaningful focus/keyboard behavior, and independent attachment controls.

Completion: focused integration/accessibility coverage passes. UI visibility checks are not described as proof of signed wallet possession or backend authorization; existing backend checks must support access claims.

## Stage 2 — ordered integration and acceptance work

Integrate C20, C21, and C22 in that order, even if workers finish differently.

After C21 is committed, refresh Worker B's source copy from the new canonical baseline and start C23. After C22 is committed, refresh Worker C's source copy and start C24. C23 and C24 can then proceed in parallel because their feature ownership remains separate. Worker A may perform read-only review of C20 evidence or final contract/API alignment; it receives no overlapping edit ownership.

### C23: administrator acceptance journey

Build on C21 rather than duplicating its state matrix. Exercise a coherent protected queue/detail/review/resolution journey against the final backend contract, including:

1. A permitted administrator reaches a case through the protected surface.
2. An unauthorized action is rejected without chain execution or a success state.
3. A permitted operation encounters a recoverable failure/uncertain saved transaction.
4. Recovery uses the original identity without resubmission.
5. Verified terminal detail and timeline are refreshed consistently.

Connect UI fixtures to actual backend result types and existing route/backend tests. Prefer real in-process handlers/domain functions where the current harness supports them; mock wallet signing/RPC transport at the outer seam. If the harness cannot connect all layers, provide linked UI/route/backend evidence and state the seam explicitly, rather than claiming a live journey. A typed mock alone does not prove backend authorization.

### C24: participant acceptance journey and handoff

Build on C22 to exercise case access, evidence/response, timeline, and saved/uncertain marking as one coherent path:

1. An unrelated participant cannot read or act on the case.
2. A permitted participant submits valid evidence/response and sees the returned workflow state.
3. A saved case with uncertain marking remains identifiable and cannot create a duplicate case or blindly submit another transaction.
4. Read or bookkeeping recovery preserves useful context and reflects the authoritative result.
5. Keyboard/label/error checks remain valid throughout recovery and access changes.

Map each acceptance step to UI coverage and real backend permission/mutation evidence. Prepare final C19–C24 source/test/commit traceability and known limitations. Integrate and commit C23 before C24.

## Commit and verification protocol

For each deliverable, the coordinator:

1. Checks the worker bundle against its base revision and allowed paths; rejects unrelated or generated output.
2. Applies only that deliverable to the canonical checkout. Later bundles remain outside the checkout, so checks cannot accidentally depend on unfinished future work.
3. Resolves integration changes manually and rechecks the exact affected behavior. No blanket conflict resolution or broad staging.
4. Runs necessary focused tests and affected-package types/lint. Runs required `pnpm lint:fix` and allows the normal pre-commit hook; audits every resulting change. Excludes unrelated formatting and regenerates outputs only through supported commands.
5. Updates the deliverable's evidence and affected vault notes only when justified. Records exact commands, counts, failures, and local/live limitations; does not reuse historical counts as new results.
6. Reviews the staged diff and `git diff --check`, then commits only the selected deliverable. Checks hook output, final commit content, and remaining working-tree changes.

Use recent conventional commit style, for example:

- `feat(contracts): verify backend deployment identity (D2 C20)`
- `test(admin): cover settlement integration boundaries (D2 C21)`
- `test(disputes): cover participant integration and accessibility (D2 C22)`
- `test(admin): verify protected resolution acceptance path (D2 C23)`
- `test(disputes): verify participant acceptance path (D2 C24)`

Choose `fix`, `feat`, or `test` based on actual final changes. Do not amend the existing C19 commit. Include this plan with the first relevant new commit, not as a fabricated deliverable commit. If a row is already fully satisfied, record its existing evidence and skip unnecessary changes while preserving the order of remaining new commits.

## Necessary checks

Use actual package scripts and installed versions. Expected commands, narrowed to changed files when appropriate:

| Scope | Checks |
| --- | --- |
| C19 baseline | `pnpm --filter @repo/backend test tests/disputes/c19.rpc-reconciliation.test.ts`; `pnpm --filter web test core/admin/settlement-recovery.test.ts` |
| C20 | Dedicated verifier suite; local contract build and relevant Rust tests for the exact source whose identity is recorded; shell syntax checks if a shell entry point changes |
| C21/C23 | `pnpm --filter web test features/admin`; affected route/recovery suite when those seams change |
| C22/C24 | `pnpm --filter web test features/disputes`; attachment/accessibility tests only if touched; focused backend access/evidence suites supporting acceptance claims |
| Web types | `pnpm --filter web exec tsc --noEmit`, with route type generation if required |
| Backend types if changed | Backend `convex/tsconfig.json` and `tests/tsconfig.json` through installed TypeScript |
| Commit checks | Required root lint/fix hook, changed-path formatting verification, staged diff review, `git diff --check` |
| Final integration | Full web suite and web production build once; full backend suite if backend code/harness changed; contract workspace tests/build if contract source changed, plus C20 identity prerequisites |

Do not rerun expensive broad suites at every checkpoint without cause. Do not add a new browser/E2E framework unless existing tools cannot prove a required behavior and the extra scope is justified. Passing mocked tests does not prove deployed code, live storage access, signed participant identity, or Testnet transaction execution.

## Stop conditions and final report

- A later item cannot be committed ahead of a materially blocked earlier item. Independent worker preparation can continue.
- Missing live deployment scope blocks live C20 evidence, not local verifier implementation or other local work.
- Shared API changes require coordinator review and refreshed dependent baselines before integration.
- A tool or hook failure is reported with the exact limitation; never bypass it silently.
- No force pushes, history reordering, secrets in evidence, or fabricated developer attribution.

Final output: C19 baseline/correction status; C20–C24 completion matrix; chronological hashes; precise verification results; affected documentation; live verification status; remaining blockers and explicit limits. The branch remains local for the user to review.
