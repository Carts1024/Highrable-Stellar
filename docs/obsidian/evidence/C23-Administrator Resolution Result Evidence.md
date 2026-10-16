---
type: evidence
area: admin
status: current
last_updated: 2026-10-15
source_of_truth: repository
---

# C23 — Administrator Resolution Result Evidence

## Scope

C23 closes the administrator browser-validation gap for successful settlement results. The changed production surface is limited to the administrator API response validator and settlement coordinator; participant components, backend authorization, Convex schemas/generated files, contracts, wallets, deployment, and environment configuration were not changed.

## Verified implementation

- `apps/web/features/admin/lib/admin-api.ts` now validates a `succeeded` result against `TAdminResolutionSucceededResult`: `resolved_client` requires `0` bps, `resolved_freelancer` requires `10,000`, and `split_resolution` requires an integer `1–9,999`. Payout/refund values must be finite and nonnegative; the resolution hash must be 64 hexadecimal characters; and the existing explorer URL must be an HTTPS Stellar Expert URL. Returned amounts are passed through unchanged.
- `apps/web/features/admin/hooks/use-admin-settlement.ts` stores the selected status/bps alongside the operation and signed hash. Final and reconciled success must match the saved status, bps, and normalized transaction hash. Malformed or mismatched results fall through recovery and retain the saved operation; successful recovery does not execute Stellar again.
- `apps/web/app/api/admin/disputes/[disputeId]/resolve/route.ts` remains unchanged. Existing protected checks and backend finalization boundaries remain in force.

## Test evidence

Focused C23 run:

| Area | Result |
| --- | ---: |
| Admin API validation | 58 tests passed |
| Server-auth and protected-route recovery | 6 + 29 + 33 tests passed |
| Admin session gate | 8 tests passed |
| Detail/coordinator/deferred recovery | 101 tests passed |
| Protected session/participant subscriptions | 17 tests passed |
| Focused total | 252 tests passed across 7 files |
| Full web suite | 486 tests passed across 29 files |

The cross-interface suite covers all three outcomes for both micro-gig and milestone cases, renders each accepted terminal state for client and freelancer subscriptions, checks returned amounts/hash/explorer URL, moderator identity and preserved opening history, and publishes participant data only after accepted settlement recording. Pending, failed, rejected, and malformed paths do not mutate the terminal case state or publish a fabricated participant resolution. Detail tests cover delayed final/reconciliation responses after case, wallet, network, and unmount changes; duplicate clicks; final-recording failure followed by reconciliation; successful recording followed by failed detail refresh; and no second Stellar execution or settlement write during read recovery.

Protected-route tests cover full successful result passthrough and reject wrong-case attempts, pending/failed verification, and conflicting escrow state before successful finalization. Authentication/session tests remain green.

## Validation commands

- `pnpm --filter web test` — passed: 486 tests across 29 files.
- `pnpm --filter web exec tsc --noEmit` — passed.
- Scoped `pnpm exec oxlint ...` — passed with 0 warnings and 0 errors.
- Scoped `pnpm exec oxfmt --write ...` — passed.
- `pnpm --filter web build` — passed; Next.js 16.1.6 production build completed.
- `git diff --check` — passed; Git emitted only the repository’s LF/CRLF normalization warnings.

## Limitations

Evidence is local and mocked. It does not establish live Convex subscription propagation, wallet possession/signature validity, Testnet settlement, deployed contract compatibility, backend side-effect execution, or broader C24 responsive/accessibility acceptance. Existing whole-unit payout truncation remains outside C23.
