---
type: workflow
area: workflow
status: current
last_updated: 2026-10-23
source_of_truth: repository
---

# Debugging

## Triage order

1. Identify the layer: browser route, Convex function, RPC/Horizon, wallet signer, smart-account verifier, relayer, or contract.
2. Capture the relevant wallet mode, network label, contract/asset ID, action, and transaction hash without recording secrets.
3. Check the configured network/passphrase/RPC/Horizon and the current on-chain status.
4. Compare the participant actor with the transaction source, fee payer, signer, and verifier; see [[stellar/Wallet Identity Model]].
5. Inspect simulation output before retrying a failed submission.
6. If a hash exists, check chain confirmation before submitting a duplicate.
7. Compare Convex phase/transaction records with contract reads using [[backend/Sync and Scheduled Jobs]].
8. If the chain is terminal while Convex still says `Disputed`, do not retry settlement. The admin recovery path searches the assigned admin's Horizon account history, matches the exact successful `resolve_dispute` call, verifies its hash through RPC and reconciles normal local bookkeeping without resubmitting or requesting a pasted hash. The scan is anchored after the dispute-mark transaction when available; without that anchor it is bounded to recent history, and Highrable has no continuously maintained historical transaction indexer.

## Common patterns

| Symptom | First checks |
| --- | --- |
| Wrong-wallet/unauthorized | Client/freelancer/admin actor, connected wallet, stored participant, smart-account address. |
| Simulation failure | Contract status, asset allowlist, token units, hash shape, network/passphrase. |
| Passkey auth failure | WASM hash, verifier, RP ID/current hostname, active signer, context rule IDs, kit version. |
| Trustline/top-up failure | Horizon network, funded classic account, USDC trustline, spendable XLM, path liquidity/slippage. |
| Convex state stale | Whether the product flow invoked sync, action env config, on-chain read, terminal-state guard. |
| Admin escrow is `Released` but dispute remains open | Run automatic admin reconciliation for the exact contract/escrow; the server searches the assigned admin's history and will not submit a second settlement. |
| Confirmation timeout | Preserve hash, inspect explorer/RPC, avoid blind retry, reconcile local phase. |

## Evidence discipline

Use source/tests/config as the authority. Do not infer production readiness from UI copy, a passing local simulation, a deployment JSON alone, or a phase/roadmap document. Record unresolved uncertainty in the relevant note as `Status: Not documented yet` when the repository does not answer it.
