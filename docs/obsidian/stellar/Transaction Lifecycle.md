---
type: reference
area: stellar
status: current
last_updated: 2026-09-26
source_of_truth: repository
---

# Transaction Lifecycle

## External-wallet contract call

The shared path in `apps/web/core/stellar/transaction.ts` is:

1. Load the source account from Soroban RPC.
2. Build the contract invocation with the configured network passphrase and a 30-second transaction timeout.
3. Prepare/simulate the transaction through RPC.
4. Ask the connected wallet to sign the prepared XDR.
5. Submit the signed transaction.
6. Poll for confirmation up to 18 attempts with a 1.5-second delay.
7. Return the transaction hash and decoded return value, or preserve the hash when confirmation fails.

`simulateContractCall` is the read/preflight helper. `invokeContract` is the signed submission helper.

## Optional Velo-sponsored Testnet call

With the Velo flag enabled, steps 1–4 are unchanged. The wallet signs the prepared inner transaction, then the browser hands that XDR and the stable transaction operation ID to the authenticated server route. The server validates the session wallet and exact one-operation Soroban shape, calls `sponsorAndSubmit` once with an idempotency key and bounded deadline, and returns only safe execution identity/status data.

`submission_unknown`, `claimed`, and `submitted` remain pending. The server persists the request ID and inner hash immediately and uses `getStatus`/`waitForResult` with identity only for recovery; it never resubmits the signed XDR after an uncertain result. A succeeded result may include both the inner transaction hash and sponsored outer fee-bump hash, and confirmation polls the outer hash when present. `actualFeeStroops` remains null until known. Failed/cancelled are terminal non-success states. This path is Testnet-only and does not apply to passkey smart-account calls.

## Passkey-smart-account call

`apps/web/core/stellar/transactionExecutor.ts` routes the call to `passkeySmartAccountExecutor.ts`. That path performs smart-account configuration/readiness checks, builds the contract call, obtains simulation authorization entries, signs them with the WebAuthn/AuthPayload flow, and submits through the selected relayer/source-account path.

## Local bookkeeping

Product flows record phases in Convex before/after chain work. Escrows, disputes, cancellations, submissions, and transaction records carry transaction hashes and pending/success/failed states where the domain needs them. A local success record is not itself proof of chain finality; the chain hash and subsequent read/sync remain important.

## Error interpretation

`normalizeStellarError` distinguishes user rejection, missing/funded-account problems, simulation failures, wrong-wallet authorization, invalid escrow status, timeouts, and failed transactions. Confirmation timeouts retain the transaction hash so an operator can check the explorer before retrying.

## Amounts and hashes

Use the configured asset decimals and the helpers in `apps/web/core/stellar/amounts.ts`/`hashes.ts`. The escrow contract expects integer token units and a 32-byte job/proof hash; do not pass display strings or an unnormalized text hash to contract wrappers.

See [[data/State Machines]], [[modules/Sync and Transactions]], and [[operations/Testing]].
