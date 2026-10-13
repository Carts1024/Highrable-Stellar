# Deliverable 2 C19 — RPC normalization and recovery

Verified locally on 2026-10-08 on `instawards/dev/sherwin`, as requested. This is the Deliverable 2 C19 scope; Deliverable 1 C19 participant evidence work remains separate.

## Changes and acceptance evidence

| Boundary | Behavior | Regression evidence |
| --- | --- | --- |
| Convex contract reads | Escrow and completion IDs must match the requested u64 ID. Addresses, integer bounds, 32-byte hashes, completion ratings, and escrow statuses are validated before records reach sync mutations. | `packages/backend/tests/disputes/c19.rpc-reconciliation.test.ts` |
| Missing versus malformed data | A missing completion remains `null`; malformed records throw and follow the existing recoverable read-failure path. Unknown/prototype-name status values are rejected. | Missing simulation results, malformed records, mismatched IDs, and invalid field cases |
| Escrow sync | Failed reads record failure metadata without advancing escrow/job/milestone state. A later valid read can reconcile to disputed and clear the read error. Generic sync still cannot finalize disputed escrow. | Both micro-gig and milestone actions exercised through `convex-test` and mocked RPC simulation |
| Saved settlement transaction | Recovery accepts only known RPC statuses, validates expiry inputs/ledger times, and computes the returned envelope hash under the configured network. The hash must match the saved transaction; a fee-bump envelope may match its inner hash. Existing exact invocation checks still apply. | `apps/web/core/admin/settlement-recovery.test.ts` uses real SDK transaction envelopes |
| Recovery route | Unreadable/mismatched escrow reads leave the attempt untouched. A later verified success can finalize it. Failed/expired results require the escrow to remain disputed. Pending results stay pending. | Real resolve route and chain verifier with mocked RPC and Convex client; assertions prohibit `sendTransaction` |

The HTTP route lives in the web package because it is the existing trusted server boundary for Convex settlement callbacks. No new recovery endpoint, schema, generated API, or transaction submission path was introduced.

## Verification

| Command / location | Result |
| --- | --- |
| `vitest run tests/disputes/c19.rpc-reconciliation.test.ts` in `packages/backend` | 31 passed |
| `vitest run core/admin/settlement-recovery.test.ts` in `apps/web` | 27 passed |
| `vitest run` in `packages/backend` | 361 passed, 13 files |
| `vitest run` in `apps/web` | 330 passed, 24 files |
| `tsc --project packages/backend/convex/tsconfig.json --noEmit` | Passed |
| `tsc --project packages/backend/tests/tsconfig.json --noEmit` | Passed |
| `tsc --noEmit` in `apps/web` | Passed |
| Scoped `oxlint --fix`, `oxfmt`, and `git diff --check` | Passed |

Commands used installed `.cmd` binaries. The attempted `pnpm --filter @repo/backend lint:fix` could not start because the local pnpm launcher references a missing executable. Sandbox dependency/cache errors disappeared when the tests and type checks were run with access to their installed dependencies. Existing web error-boundary fixture logs and environment notices are expected; the backend also reports a Vite config-loader advisory.

## Limits

This evidence uses mocked RPC transport and local Convex execution. It does not prove live RPC availability, deployed contract identity, signed participant-wallet possession, or a full Testnet lifecycle. No Convex target was configured in the checked local environment files, so no deployment was attempted. Generic sync still relies on the configured deployment and the repository's existing escrow-ID mapping; it is not safe migration tooling for overlapping contract ID spaces.
