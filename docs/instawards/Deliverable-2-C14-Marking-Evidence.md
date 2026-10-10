# Deliverable 2 C14 — Dispute marking callbacks and retry coverage

Verified locally on 2026-10-07. C14 completes the backend callback/retry item in the Deliverable 2 sprint plan. The existing `c13.idempotency.test.ts` and `c21.reconciliation.test.ts` filenames refer to earlier backend coverage, not the similarly numbered Deliverable 2 contract/frontend tasks.

## Implementation and acceptance evidence

Production changes are confined to `packages/backend/convex/disputes/mutations.ts`: first-failure audit text, system messages, and notifications explain reconciliation for a recorded hash and permit hashless retry only if the operation was not submitted. Audit and system-message transaction references use the stored-or-incoming hash. No callback guards or public contracts changed.

All test paths below are relative to `packages/backend/tests/disputes/`.

| Acceptance criterion | Existing evidence retained | Distinct C14 evidence in `c14.marking.test.ts` |
| --- | --- | --- |
| Legal transitions update once | C13 initial start, duplicate start, success replay, hashless retry, invalid phases; C21 retry and parent mirror recovery | Two three-failure/retry sequences assert exact opening/start/failure/success event counts, message and notification counts, cleared current error, unrelated nested metadata, preserved historical failure details, and unchanged parent records. |
| Known-hash retries wait for reconciliation | C13/C21 reject known-hash retry and conflicting success; C21 exercises existing mirror recovery | Two late-enrichment sequences compare every relevant record, proving only the absent hash changes, then reject retry/conflicting callbacks, accept matching success, and preserve stale-failure/success replays. Six first-failure cases cover incoming, stored, and matching stored-plus-incoming hashes, normalized hashes, guidance on all three channels, and audit/message hash references. |
| Stale failures cannot overwrite success | C13/C21 confirmed-state replay cases | Confirmed records remain completely equal after hashless or matching-hash stale failures and duplicate success, with the clock advanced between callbacks. Conflicting hashes reject without writes. |
| Terminal review statuses reject changes and retain harmless replays | C13 covers all terminal statuses from `not_marked` and a resolved-client confirmed replay | 32 cases cross all four terminal review statuses with marking, hashless failure, known-hash failure, and confirmed phases for both parent kinds. Each callback is checked individually, including rejected late hash enrichment and conflicting hashes. Terminal starts remain rejected even while marking, preserving existing behavior. |
| Authorization precedes idempotent returns | C13 participant/configured-admin actor attribution, external-wallet/passkey attribution, and unauthorized initial callbacks | Eight cases exercise unrelated-wallet start, success, hashless failure, and hash-bearing failure callbacks across four phases and both parent kinds. Every denial asserts the authorization error and complete record preservation. |
| Frozen API and persistence contract | Existing API/schema/index contract suites | All callback arguments, boolean returns, validators, statuses, schemas, and participant/configured-admin checks remain unchanged in the production diff. Full backend contract suites pass. |

The new suite contains 50 cases: 32 terminal, 8 authorization, 2 repeated-cycle, 2 late-enrichment, and 6 first-failure hash cases. It reuses `convex-test`, the module map, shared fixtures, and the deterministic clock setup. Snapshot comparisons include the complete dispute, audit events, messages, notifications, conversations, transactions, escrow, job, and optional milestone, including their timestamps. Every rejected or replayed callback advances the clock before comparing records; accepted transitions separately assert exact side-effect counts. Full-table reads are restricted to the isolated test database.

## Validation

| Command | Actual result |
| --- | --- |
| `pnpm --filter @repo/backend test tests/disputes/c13.idempotency.test.ts tests/disputes/c21.reconciliation.test.ts` | Baseline: 36 tests passed, 2 files. |
| `pnpm --filter @repo/backend test tests/disputes/c14.marking.test.ts tests/disputes/c13.idempotency.test.ts tests/disputes/c21.reconciliation.test.ts` | 86 tests passed, 3 files, including 50 new C14 cases. |
| `pnpm --filter @repo/backend test` | 312 tests passed, 12 files. |
| `pnpm exec tsc --project packages/backend/convex/tsconfig.json --noEmit` | Passed. |
| `pnpm exec tsc --project packages/backend/tests/tsconfig.json --noEmit` | Passed. |
| `pnpm exec oxlint packages/backend/convex/disputes/mutations.ts packages/backend/tests/disputes/c14.marking.test.ts` | Passed. |
| `pnpm exec oxfmt --check packages/backend/convex/disputes/mutations.ts packages/backend/tests/disputes/c14.marking.test.ts` | Passed. |

Vitest emitted existing Vite configuration and experimental localStorage warnings; tests passed. Complete change review confirms scope is limited to failure guidance/hash references, the new regression suite, and project memory. Authorization executes before replay returns; terminal, conflict, and retry guards remain untouched. No frontend, contract, settlement, generated API, schema, migration, or configuration changes are included.

## Boundaries

- These tests establish Convex bookkeeping behavior, not independent on-chain verification or transaction confirmation.
- Caller-supplied wallets remain an existing authentication limitation; participant/configured-admin membership checks do not establish wallet possession.
- The frozen callback API has no attempt IDs. Callbacks from separate hashless attempts cannot always be distinguished, and a hashless record alone does not prove that an operation was never submitted. The new guidance makes that retry precondition explicit without changing backend acceptance rules.
- Late hash enrichment preserves first-failure details, timestamps, and historical side effects rather than rewriting their original hashless guidance. Subsequent retries are blocked by the newly recorded hash.
- Known-hash recovery uses existing reconciliation boundaries; C14 adds no reconciliation service.
- No deployment, live transaction, external-service change, or production configuration change was performed.
