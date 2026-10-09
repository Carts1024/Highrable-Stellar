# Deliverable 2 C21 — administrator resolution integration

Implemented on 2026-10-09. Existing basis-point, settlement phase, failure, recovery, and final-confirmation tests are retained rather than duplicated.

## Demonstrated gap and fix

The protected page could unmount after a wallet change while settlement continued through deferred authorization, start recording, hash calculation, simulation/signing, or signed-identity persistence. New integration regressions failed against the original hook. `use-admin-settlement.ts` now checks the original case/wallet context after those waits, before invoking the signer, before and after signed-identity recording, and before final bookkeeping. A stale callback cannot submit a transaction or clear a newer execution's running state. Persisted attempts remain available to the existing authorized recovery route.

The real `AdminSessionGate`, protected detail, query client, HTTP client, and settlement coordinator are exercised with controlled HTTP and wallet/Stellar seams. Nine new cases cover on-chain membership revocation, started-request 401/403 access eviction, and six deferred wallet-change boundaries. Existing tests supply exact basis-point boundaries, duplicate-click protection, known-hash uncertainty, verified failure retry, and success only after verified recording.

## Verification

- Focused administrator suite: 199 tests across 7 files.
- Web TypeScript and scoped formatting/lint checks; existing hook warnings about render refs/effect state are unchanged.
- Pre-fix deferred-origin regressions fail; the same cases pass with the guards.

The coordinator runs the required repository lint/typecheck workflow before each commit. The local hook was initially absent: C20's required workflow ran manually, then the existing Husky hook was initialized before C21. No hook was bypassed.

This is local component/integration evidence with mocked HTTP, wallet, and chain boundaries. It does not establish live session, deployed contract, or Stellar execution. No backend schema/API or contract semantics changed.
