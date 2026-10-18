---
type: reference
area: stellar
status: current
last_updated: 2026-10-18
source_of_truth: repository
---

# Transaction Lifecycle

## External-wallet contract call

The shared path in `apps/web/core/stellar/transaction.ts` is:

1. Load the source account from Soroban RPC.
2. Build the contract invocation with the configured network passphrase and a 30-second transaction timeout.
3. Prepare/simulate the transaction through RPC.
4. Ask the connected wallet to sign the prepared XDR.
5. Persist any signed identity through the caller's `onSigned` barrier.
6. Submit the signed transaction.
7. Poll for confirmation up to 18 attempts with a 1.5-second delay.
8. Return the transaction hash and decoded return value, or preserve the hash when confirmation fails.

`simulateContractCall` is the read/preflight helper. `invokeContract` is the signed submission helper.

## Optional Velo-sponsored Testnet call

With the Velo flag enabled, steps 1–4 are unchanged. The wallet signs the prepared inner transaction, then the browser hands that XDR and the stable transaction operation ID to the authenticated server route. The server validates the session wallet and exact one-operation Soroban shape, calls `sponsorAndSubmit` once with an idempotency key and bounded deadline, and returns only safe execution identity/status data.

`submission_unknown`, `claimed`, and `submitted` remain pending. The server persists the request ID and inner hash immediately and uses `getStatus`/`waitForResult` with identity only for recovery; it never resubmits the signed XDR after an uncertain result. A succeeded result may include both the inner transaction hash and sponsored outer fee-bump hash, and confirmation polls the outer hash when present. `actualFeeStroops` remains null until known. Failed/cancelled are terminal non-success states. This path is Testnet-only and does not apply to passkey smart-account calls.

## Passkey-smart-account call

`apps/web/core/stellar/transactionExecutor.ts` routes the call to `passkeySmartAccountExecutor.ts`. That path performs smart-account configuration/readiness checks, builds the contract call, obtains simulation authorization entries, signs them with the WebAuthn/AuthPayload flow, and submits through the selected relayer/source-account path.

Each readiness evaluation fetches and verifies the configured WASM hash once, reusing it for that evaluation. There is no cross-operation cache. Executor validation still runs after connection, and feature readiness checks and existing signer/fee-payer relationships remain enforced.

## Marketplace escrow progress

Marketplace creation and funding actions expose the local stages `preparing`, `simulating`, `awaiting_signature`, `submitting`, `confirming`, `recovering_escrow_id`, and `recording`. The job form and escrow/milestone action panels pair the shared spinner with descriptive polite status text, set `aria-busy`, and block repeat actions through recording. Wallet/context changes and unmount invalidate progress callbacks so old operations cannot overwrite a replacement view.

The job form's external-wallet **fund now** operation is one `create_and_fund_open_escrow` contract invocation and one `create_escrow` history row. Its signed transaction hash is persisted as pending before submission. Only after chain confirmation and both required local writes does the operation report success. A confirmed transaction whose escrow ID cannot be recovered keeps its hash as successful chain history and reports a recovery error; it does not submit again. See [[modules/Escrow and Payments]].

When a creation response does not contain an escrow ID, fallback recovery starts at the next ID observed before submission, reads candidates in ascending batches of at most four, and returns the lowest match after checking client, freelancer, asset, amount, and job hash. Candidate read failures are ignored; range-read failures and no-match outcomes preserve the transaction hash in the recovery error. If the executor returned a hash without confirmed chain status, that recovery error remains pending and the user must check status before retrying. A confirmed recovery failure is marked confirmed in transaction history and reported without resubmission.

### Local recovery timing evidence

The deterministic mocked comparison in `apps/web/core/stellar/escrow-contract.test.ts` scans 16 candidate IDs with a 10 ms delay per mocked candidate read. The updated four-at-a-time implementation makes 18 total mocked RPC calls (two range reads and 16 candidates), has at most four candidate reads in flight, and completes in 40 ms of fake-clock time. The same fixture using the prior sequential scheduling model also makes 18 RPC calls and takes 160 ms of fake-clock time. These figures compare local scheduling under a synthetic delay; they are not observed Stellar RPC latency, a production percentage improvement, or evidence of deployed behavior.

## Local bookkeeping

Product flows record phases in Convex before/after chain work. Escrows, disputes, cancellations, submissions, and transaction records carry transaction hashes and pending/success/failed states where the domain needs them. Participant dispute marking now records the signed external-wallet hash in a pending transaction before submission and keeps uncertain or possibly submitted outcomes pending. A confirmed chain result is recorded separately from later Convex dispute, transaction, and escrow bookkeeping; a failed bookkeeping step does not create an on-chain failure event or permit a second chain submission. A local success record is not itself proof of chain finality; the chain hash and subsequent read/sync remain important.

Participant marking uses one generation-scoped browser execution lock from preparation through all recording mutations. The scope includes the dispute/parent, wallet address, wallet mode, connection, network, signing capability, and participant permission. The lock is held while a confirmed operation records its dispute callback, transaction success, and parent escrow status. A recording retry reuses the original actor, hash, operation ID, and parent references and does not call Stellar. Scope changes and unmount invalidate local phases/errors/hashes and prevent late callbacks from updating a replacement view; a signed external-wallet callback is guarded before submission so obsolete work cannot continue after the identity changes.

## Error interpretation

`normalizeStellarError` distinguishes user rejection, missing/funded-account problems, simulation failures, wrong-wallet authorization, invalid escrow status, timeouts, and failed transactions. Confirmation timeouts retain the transaction hash so an operator can check the explorer before retrying.

`invokeContract`, the shared transaction executor, and escrow wrappers accept optional execution-phase notifications for simulation, signing, submission, and confirmation. These notifications are observational only. The locally computed transaction hash is retained for signed-identity persistence failures, submission transport errors, confirmation failures/timeouts, and sponsored Velo handoff/status uncertainty; admin recovery reconciles that identity without resubmitting.

The shared wrapper forwards phase callbacks through standalone escrow creation/funding calls and the atomic creation call. Marketplace progress remains local presentation state; it does not alter the executor's simulation, confirmation polling, fee path, or mutation ordering. Per the [Stellar transaction lifecycle guide](https://developers.stellar.org/docs/build/guides/transactions/submit-transaction-wait-js), successful submission is distinct from the later confirmation result, so UI success must wait for confirmation and required bookkeeping.

## Administrator settlement submission boundary

The administrator settlement coordinator validates the requested outcome terms immediately before execution: `resolved_client` is `0` bps, `resolved_freelancer` is `10000` bps, and `split_resolution` is an integer from `1` through `9999` bps. This protects the API and Stellar path even when a form draft or callback supplies stale or malformed numeric data.

The protected start acknowledgment must echo the requested operation ID and basis points. The signed acknowledgment must echo the operation ID and the normalized transaction hash. Missing, malformed, or mismatched acknowledgments stop the lifecycle before the next side effect. The coordinator rechecks its generation identity after preparation awaits, before signing, and at the signed-identity barrier before submission; case, wallet, connection, network, wallet-mode, signing-capability, and unmount changes invalidate obsolete callbacks. Persisted signed identities still reconcile through the existing server-verified recovery path, and known hashes are never submitted a second time.

C15 coverage is local mocked frontend/API/executor evidence. It does not prove deployed-contract compatibility, wallet-provider behavior, or live-chain acceptance.

## Amounts and hashes

Use the configured asset decimals and the helpers in `apps/web/core/stellar/amounts.ts`/`hashes.ts`. The escrow contract expects integer token units and a 32-byte job/proof hash; do not pass display strings or an unnormalized text hash to contract wrappers.

See [[data/State Machines]], [[modules/Sync and Transactions]], and [[operations/Testing]].
