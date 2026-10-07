---
type: evidence
area: admin
status: current
last_updated: 2026-10-07
source_of_truth: repository
---

# C15 - Administrator Settlement Submission Evidence

## Scope

C15 hardens the existing administrator settlement form and coordinator at the submission boundary. It does not change public API payloads, Convex types/schema, dispute statuses, contract interfaces, wallet executor routing, backend payment arithmetic, participant flows, migrations, generated files, or deployments.

## Implementation map

- `apps/web/features/admin/lib/settlement-validation.ts` validates execution terms for all three outcomes, including fixed-term mismatches, split boundaries, non-finite values, and unknown outcomes.
- `apps/web/features/admin/lib/admin-api.ts` verifies started acknowledgments against operation ID and basis points, and signed acknowledgments against operation ID and normalized transaction hash.
- `apps/web/features/admin/hooks/use-admin-settlement.ts` assigns each execution a generation identity and rechecks the active case, wallet/session context, network, mode, connection, and signing capability after awaits, before signing, and at the signed-identity barrier.
- `apps/web/features/admin/*test*` covers rejection side-effect isolation, acknowledgment failures, deferred context changes, obsolete callbacks, unmounts, uncertain recovery, and known-hash no-resubmission behavior.

## Acceptance evidence

| Area | Result |
| --- | --- |
| Settlement terms | Client `0`, freelancer `10000`, and split `1..9999` bps accepted; mismatches, malformed numeric values, unknown outcomes, and split boundary violations rejected before API/Stellar calls. |
| Acknowledgments | Missing, malformed, and mismatched operation IDs, basis points, and hashes block progression. Signed hashes are compared after normalization; server-side Stellar verification remains authoritative. |
| Stale execution | Wallet/case replacement, disconnect, network or wallet-mode change, signing-context change, deferred writes, signed-identity recording, and unmount invalidate obsolete executions. Old callbacks cannot contaminate a replacement attempt or release its lock. |
| Recovery | Existing simulation, signed-hash persistence, server-verified finalization, phase feedback, read-only refresh retry, uncertain-attempt recovery, and known-hash reconciliation remain intact; known hashes are not resubmitted. |

## Verification

- Focused administrator suite: 220 passing tests across 7 files.
- Full web suite: 333 passing tests across 23 files.
- Web TypeScript: passed.
- Scoped `oxlint` and `oxfmt --check`: passed.
- Web production build: passed.

## Limitations

This is local mocked frontend/API/chain-executor evidence. It does not establish deployed-contract compatibility, wallet-provider behavior, server deployment state, or live-chain acceptance. C15 evidence is recorded separately from broader C21/C23 acceptance work.
