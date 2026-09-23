---
type: reference
area: stellar
status: current
last_updated: 2026-09-21
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

## Passkey-smart-account call

`apps/web/core/stellar/transactionExecutor.ts` routes the call to `passkeySmartAccountExecutor.ts`. That path performs smart-account configuration/readiness checks, builds the contract call, obtains simulation authorization entries, signs them with the WebAuthn/AuthPayload flow, and submits through the selected relayer/source-account path.

## Local bookkeeping

Product flows record phases in Convex before/after chain work. Escrows, disputes, cancellations, submissions, and transaction records carry transaction hashes and pending/success/failed states where the domain needs them. A local success record is not itself proof of chain finality; the chain hash and subsequent read/sync remain important.

## Error interpretation

`normalizeStellarError` distinguishes user rejection, missing/funded-account problems, simulation failures, wrong-wallet authorization, invalid escrow status, timeouts, and failed transactions. Confirmation timeouts retain the transaction hash so an operator can check the explorer before retrying.

## Amounts and hashes

Use the configured asset decimals and the helpers in `apps/web/core/stellar/amounts.ts`/`hashes.ts`. The escrow contract expects integer token units and a 32-byte job/proof hash; do not pass display strings or an unnormalized text hash to contract wrappers.

See [[data/State Machines]], [[modules/Sync and Transactions]], and [[operations/Testing]].
