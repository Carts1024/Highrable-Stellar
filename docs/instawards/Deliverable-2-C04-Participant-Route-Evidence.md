# Deliverable 2 C04 — Participant route handling

Date: 2026-10-14
Branch: `instawards/dev/sherwin`

## Scope and implementation

Reviewed the existing wallet-scoped list/detail queries, loading and empty states, permission gating, missing-case handling, status labels, route parameter validation, and query-error fallback against Deliverable 2 C04. Existing implementations and regression coverage remain the baseline.

One missing transition was reproduced: after a query failure, switching wallets or disconnecting left the route on the previous wallet's error screen. `apps/web/app/disputes/error.tsx` now observes the active wallet address and resets the boundary on a change. Same-wallet renders do not retry automatically, including when the reset callback changes; the Retry button still works.

## Verification

- Before the fix, both new wallet-switch/disconnect regressions failed because the old alert remained visible.
- After the fix, `dispute-route-states.test.tsx`: **15 passed**, including the new same-wallet/manual-retry regression.
- Web TypeScript passed.
- Full web suite: **349 passed across 24 files** with `vitest run --maxWorkers=2 --minWorkers=1`. The initial concurrent validation run hit element-wait limits in two unrelated administrator tests; the bounded-worker run passed without changing those tests.
- Scoped oxlint and oxfmt passed; `pnpm lint:fix` could not start because the machine's pnpm 12.5.1 launcher points to a missing executable. Installed workspace binaries were used instead.

Tests render the real route fallback with a test error boundary and mocked Convex reads/wallet identity. This establishes local component behavior, not live browser, wallet-provider, or deployed Convex verification.
