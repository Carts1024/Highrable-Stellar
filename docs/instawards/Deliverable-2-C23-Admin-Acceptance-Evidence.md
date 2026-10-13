# Deliverable 2 C23 — administrator acceptance path

Verified locally on 2026-10-09 against the existing backend contract.

`admin-protected-pages.integration.test.tsx` adds one coherent journey through the real protected queue, detail, evidence, review controls, and settlement coordinator:

1. The real queue Review link identifies the protected detail route.
2. A review write returns 403, removing protected content without executing settlement.
3. Access recovery permits a review update with the exact selected status/message.
4. Settlement signs once and records the operation/hash; final verification temporarily fails.
5. Pending recovery retains that identity and cannot announce success or submit another transaction.
6. A deferred verified refund response refreshes terminal detail, timeline, and queue. Refund maps to `resolved_client` and a `cancelled` escrow.

The test replaces the old mocked administrator queue with the real presentation. HTTP response fixtures use settlement API types; Next navigation is represented by mounting the linked route with the same query client. Signing, Stellar execution, and HTTP transport remain controlled seams.

## Cross-layer evidence

- Administrator suite: 200 tests across 7 files; protected integration: 30 tests.
- Web TypeScript, scoped lint, and formatting pass; normal commit hook runs repository lint/typecheck.
- The full real `convex-test` backend suite passes 361 tests across 13 files, including `c17.settlement.test.ts` for authorization, active-operation identity, recovery, and idempotency.
- `core/admin/settlement-recovery.test.ts` supplies separate real server-route/SDK verification coverage with mocked RPC and Convex transport; it verifies the saved transaction and prohibits resubmission.

These are linked local UI, route, and backend checks, not one live browser-to-Testnet run. No new status machine, backend endpoint, deployment, or live-chain completion is claimed.
