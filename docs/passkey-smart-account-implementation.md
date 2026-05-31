# Passkey Smart Account Implementation Guide

This document explains how passkey smart accounts work in Highrable and how the current web app implements passkey-based Stellar escrow execution.

## Executive Summary

Highrable supports two signing identities:

- `external_wallet`: a classic Stellar account (`G...`) connected through Stellar Wallets Kit.
- `passkey_smart_account`: a Soroban smart account contract (`C...`) controlled by a browser/device passkey through `smart-account-kit`.

For product flows, both modes are treated as Highrable wallet identities. The difference is the transaction path:

- External wallet mode signs the target escrow contract invocation directly.
- Passkey smart account mode calls the smart account contract first, then the smart account executes the target escrow method through `execute(target, target_fn, target_args)`.

In passkey mode the smart account contract address is the business identity stored in jobs, applications, escrows, user profiles, and transaction records. The user approves writes with WebAuthn instead of a wallet extension popup.

## Runtime Dependencies

Current implementation assumptions:

- `smart-account-kit`: `0.2.10`
- `smart-account-kit-bindings`: `0.1.2`
- `@stellar/stellar-sdk`: `14.2.0`
- Network: Stellar Testnet by default
- Payment asset: configured Soroban token contract, shown as stablecoin/USDC in the UI

The passkey execution layer includes compatibility code for the currently installed SDK and the deployed smart account contract ABI. Future SDK upgrades may remove some custom signing and context-rule fallback code.

## Relevant Files

Core passkey and transaction code:

- `apps/web/core/stellar/smart-account-config.ts`
- `apps/web/core/stellar/smart-account-kit.ts`
- `apps/web/core/wallet/passkey-smart-account-context.tsx`
- `apps/web/core/wallet/hooks/use-highrable-wallet-identity.ts`
- `apps/web/core/stellar/transactionExecutor.ts`
- `apps/web/core/stellar/passkeySmartAccountExecutor.ts`
- `apps/web/core/stellar/escrow-contract.ts`
- `apps/web/core/stellar/transaction.ts`

Feature integration points:

- `apps/web/features/marketplace/components/create-job-form.tsx`
- `apps/web/features/marketplace/components/applications-list.tsx`
- `apps/web/features/marketplace/hooks/use-escrow-actions.ts`
- `apps/web/features/marketplace/hooks/use-milestone-escrow-actions.ts`
- `apps/web/features/marketplace/lib/escrow-action-guards.ts`

Backend identity and transaction metadata:

- `packages/backend/convex/users/schema.ts`
- `packages/backend/convex/users/mutations.ts`
- `packages/backend/convex/users/helpers.ts`
- `packages/backend/convex/jobs/mutations.ts`
- `packages/backend/convex/applications/mutations.ts`
- `packages/backend/convex/transactions/schema.ts`
- `packages/backend/convex/transactions/mutations.ts`

## Concepts

### Passkey

A passkey is a WebAuthn credential held by the browser, operating system, password manager, or hardware authenticator. In Highrable, it is used to approve smart account authorization payloads. The app does not receive or store the private credential material.

### Smart Account

A smart account is a Soroban contract account. It owns an address that starts with `C`. Its signer set and context rules determine which passkeys or delegated accounts can authorize which actions.

### WebAuthn Verifier

The WebAuthn verifier is a deployed contract that validates WebAuthn signature data for the smart account. Highrable requires the connected signer to use the verifier configured by `NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID`.

### Context Rules

Context rules are smart account policy entries. They bind signer authorization to invocation contexts such as:

- default authorization
- calling a specific contract
- creating a contract from a specific WASM hash

Highrable resolves the context rule IDs used by a transaction and binds them into the WebAuthn challenge digest before asking for passkey approval.

## Address Model

Highrable must keep classic Stellar accounts and Soroban contract accounts separate.

| Address type | Prefix | Used for |
| --- | --- | --- |
| Classic account | `G...` | External wallet identity, fee source, RPC source account for simulations |
| Contract account | `C...` | Passkey smart account identity, escrow contract, token contract, verifier contract |

Passkey smart account writes use the smart account address as the actor. Some Stellar RPC operations still require a classic source account for transaction assembly or read simulation. In those cases Highrable uses the SDK deployer/source account exposed by `smart-account-kit`.

## Configuration

Passkey configuration is normalized in `apps/web/core/stellar/smart-account-config.ts`.

Required frontend variables:

```bash
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH=3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c
NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID=CATPTBRWVMH5ZCIKO5HN2F4FMPXVZEXC56RKGHRXCM7EEZGGXK7PICEH
NEXT_PUBLIC_APP_DOMAIN=http://localhost:3000
NEXT_PUBLIC_PASSKEY_RP_NAME=Highrable
```

Optional frontend variable:

```bash
NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL=
```

Current tested Testnet defaults for `smart-account-kit 0.2.10`:

- Smart account WASM hash: `3e51f5b222dec74650f0b33367acb42a41ce497f72639230463070e666abba2c`
- WebAuthn verifier contract: `CATPTBRWVMH5ZCIKO5HN2F4FMPXVZEXC56RKGHRXCM7EEZGGXK7PICEH`

Configuration behavior:

- `accountWasmHash` is lowercased.
- `webauthnVerifierAddress` is uppercased.
- `rpId` is derived from `NEXT_PUBLIC_APP_DOMAIN`.
- `rpName` defaults to `Highrable`.
- Known incompatible WASM hashes are blocked before account creation and execution.

Changing passkey configuration requires a web app restart. In most cases it also requires clearing local passkey session storage and creating or reconnecting an account generated with the new configuration.

## Storage and Session Management

`apps/web/core/stellar/smart-account-kit.ts` wraps the SDK singleton and storage adapter.

Highrable uses a resilient browser storage strategy:

- Primary storage: `IndexedDBStorage`
- Fallback storage: `LocalStorageAdapter`
- Retry path for transient IndexedDB closing/transaction errors
- Storage key namespace:
  - Highrable passkey prefix
  - configured smart account WASM hash prefix
  - configured WebAuthn verifier prefix
  - RP ID

This namespacing prevents stale sessions from one smart account artifact, verifier, or app domain from being reused under another configuration.

Local session cleanup clears both the current namespaced storage and the legacy un-namespaced storage key, then resets the SDK singleton.

## Account Creation Flow

Implemented in `PasskeySmartAccountProvider.createPasskeyAccount`.

Flow:

1. Check browser WebAuthn support.
2. Check required smart account configuration.
3. Block known incompatible smart account WASM hashes.
4. Create a `SmartAccountKit` instance with RPC, network passphrase, WASM hash, verifier, RP ID, RP name, storage, and optional relayer.
5. Call `kit.createWallet("Highrable", generatedUserName, options)`.
6. Submit deployment automatically with `autoSubmit: true`.
7. Validate that the created smart account has the authenticated credential as an active external WebAuthn signer.
8. Persist the wallet identity to Convex as `walletType: "passkey_smart_account"`.
9. Set the active wallet mode to `passkey_smart_account`.

Authenticator options currently prefer resident keys and user verification:

```ts
authenticatorSelection: {
  residentKey: "preferred",
  userVerification: "preferred",
}
```

## Restore and Reconnect Flow

### Restore

On app load, Highrable attempts a silent restore with `kit.connectWallet()`.

If restore succeeds, the app validates signer shape and sets the passkey smart account as the active wallet mode. If restore fails because storage is stale or the account shape no longer matches config, the user is asked to reconnect.

### Reconnect

Reconnect is credential-first:

1. Call `kit.authenticatePasskey()`.
2. Discover smart account contracts linked to the credential with `discoverContractsByCredential`.
3. If exactly one contract is found, connect with `fresh: true`.
4. If multiple contracts are found, show a contract picker and connect the selected smart account.
5. Validate signer shape after connection.
6. Persist the selected smart account identity to Convex.

This avoids accidentally executing an escrow action with an older smart account when the same passkey has created multiple accounts.

## Signer Shape Validation

`ensureConnectedPasskeyWalletShape` validates the connected account after create, restore, reconnect, and contract selection.

The validation checks:

- Smart account contract details can be read when available.
- Context rules expose active signer records.
- The authenticated credential ID belongs to an active signer.
- The signer type is `External`.
- The signer has a verifier address.
- The verifier address equals `NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID`.

This protects users from approving with a passkey that exists in the browser but is not actually authorized on the selected smart account.

## Wallet Identity Resolution

`useHighrableWalletIdentity` exposes one active identity to product code.

When active mode is `passkey_smart_account` and a smart account is connected:

- `walletAddress` is the smart account contract address.
- `walletType` is `passkey_smart_account`.
- `source` is `passkey_smart_account`.

When active mode is `external_wallet`:

- `walletAddress` is the connected classic wallet address.
- `walletType` is `external_wallet`.
- `source` is `stellar_wallets_kit`.

Jobs and applications pass `walletType` into Convex so backend user records preserve the identity type. Escrow records and role checks use the active wallet address, so passkey-created jobs use the smart account address as `clientWallet`, and passkey-submitted applications use the smart account address as `freelancerWallet`.

## Shared Escrow Execution Routing

All escrow action helpers in `apps/web/core/stellar/escrow-contract.ts` call `executeHighrableContractCall`.

External wallet path:

```text
feature hook
-> escrow-contract helper
-> executeHighrableContractCall
-> invokeContract
-> external wallet signs transaction
-> RPC submit
```

Passkey smart account path:

```text
feature hook
-> escrow-contract helper
-> executeHighrableContractCall
-> executeWithPasskeySmartAccount
-> smartAccount.execute(target, target_fn, target_args)
-> WebAuthn approval
-> RPC/relayer submit
```

This keeps marketplace and milestone feature code mostly wallet-agnostic.

## Passkey Execution Engine

The execution engine lives in `apps/web/core/stellar/passkeySmartAccountExecutor.ts`.

### Preflight Checks

Before executing a write, Highrable:

1. Sanitizes the smart account and target contract IDs.
2. Ensures the SDK is connected to the selected smart account.
3. Reconnects with a preferred contract ID when the SDK session is missing.
4. Verifies a classic deployer/source account is available for fees and transaction assembly.
5. Checks the connected smart account's on-chain WASM hash against configured `NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH`.
6. Installs context-rule compatibility fallback when needed.

### Building the Smart Account Invocation

The app does not call the escrow contract directly in passkey mode. It builds a smart account `execute` call:

```text
execute(
  target: Address,
  target_fn: Symbol,
  target_args: Vec<ScVal>
)
```

For example, funding an escrow becomes:

```text
smartAccount.execute(
  escrowContractAddress,
  "fund_escrow",
  [clientSmartAccountAddress, escrowId]
)
```

The result parser is intentionally raw `ScVal`, because smart account wrappers can return values differently from direct target contract calls.

### AuthPayload Signing

Highrable uses a custom signing pipeline because the installed SDK/bindings combination does not fully cover the AuthPayload behavior needed by the current smart account contract.

The signing sequence:

1. Build and simulate the smart account `execute` transaction.
2. Read Soroban authorization entries from simulation.
3. Resolve context rules from indexer-discovered IDs with `wallet.get_context_rule`.
4. Fall back to `get_context_rule(0)` when plural context-rule APIs are missing or incompatible.
5. Find the active external signer whose encoded credential data matches the connected credential ID.
6. Resolve context rule IDs that authorize the invocation context.
7. Build the Soroban authorization signature payload.
8. Hash the payload together with the resolved `context_rule_ids`.
9. Send that digest as the WebAuthn challenge with `allowCredentials` restricted to the connected credential.
10. Convert the DER ECDSA signature returned by WebAuthn into compact low-S format.
11. Encode `authenticator_data`, `client_data`, and `signature` as the smart account signature bytes.
12. Upsert the signer signature into the AuthPayload map.
13. Re-simulate the invoke operation with signed auth entries.
14. Assemble the prepared transaction from re-simulation results.
15. Sign with the classic source account if required.
16. Submit and poll through the SDK transport.

The important security property is that the passkey challenge is bound to both the Stellar authorization payload and the context rule IDs.

### Context Rule Resolution

The executor extracts invocation context from the authorization tree. For contract calls, it resolves the target contract from the smart account `execute` arguments so the rule lookup authorizes the inner escrow contract, not only the outer smart account contract.

Resolution preference:

1. Exact context rule with exactly the selected signer.
2. Matching context rule whose signer list is a subset containing the selected signer and has no extra policies.
3. Default context rule.
4. Sole matching candidate.
5. Error if the rule cannot be resolved uniquely.

### Transaction Submission and Fees

Passkey smart account writes need one fee path:

- A configured smart account relayer, or
- A funded classic deployer/source account exposed by the SDK.

`getPasskeyEscrowExecutionReadiness` reports whether passkey escrow execution can currently proceed and returns the relayer/source-account details used by the UI readiness panels.

When no relayer is configured, the classic source account must exist and be funded on the selected network. The smart account also needs the configured stablecoin/token balance for escrow funding actions.

## Escrow Actions Supported in Passkey Mode

The shared escrow helpers support passkey execution for:

- `create_escrow`
- `create_open_escrow`
- `create_and_fund_open_escrow`
- `fund_escrow`
- `assign_freelancer`
- `submit_work`
- `approve_and_release`
- `cancel_escrow`
- `mark_disputed`

The dedicated wrapper functions in `passkeySmartAccountExecutor.ts` cover the main action shapes, while production feature code routes through the shared `escrow-contract.ts` helpers.

## Escrow ID Recovery

Direct escrow contract creation methods return a `u64` escrow ID. In passkey mode, the outer smart account `execute` wrapper may not expose that inner `u64` directly.

Highrable handles this in `escrow-contract.ts`:

1. Read `get_next_escrow_id` before the create transaction.
2. Execute the create action.
3. Try to decode the ID from direct result/return value.
4. If unavailable, read `get_next_escrow_id` after the transaction.
5. Scan the created ID range.
6. Match on-chain escrow fields:
   - client
   - freelancer or `null` for open escrows
   - asset contract
   - amount
   - job hash
7. Return the matched escrow ID to feature code.

This lets the UI store the correct Convex escrow record even when the smart account wrapper hides the target method return value.

## Read Simulation with Passkey Accounts

Stellar RPC read simulations require a classic account source in places where the app has a passkey smart account contract address. `resolveReadSourceAddress` handles this:

- If the source is `G...`, use it directly.
- If the source is `C...`, use the SDK deployer/source account.
- If no valid classic source exists, surface "Smart account transaction fees are not configured."

This prevents invalid version byte errors from passing contract addresses where the SDK expects classic accounts.

## Error Handling

`toReadablePasskeyError` converts common low-level failures into user-facing messages:

- Missing or stale SDK connection -> reconnect the passkey account.
- WebAuthn cancellation -> passkey approval cancelled.
- Missing fee source/relayer -> smart account transaction fees are not configured.
- Unauthorized/auth failures -> smart account is not authorized for the escrow action.
- Escrow status failures -> escrow is not in the correct state.
- RPC timeouts -> sync/retry message.
- ABI mismatch -> connected account likely uses an old incompatible contract artifact.
- AuthPayload mismatch -> clear local passkey session and create/reconnect with current config.

For known AuthPayload mismatch signatures, the app attempts best-effort local session cleanup before returning the failure.

## Backend Data Model Impact

Passkey smart accounts are represented as wallet identities in Convex.

User records can store:

- `walletAddress`: smart account `C...` address or external wallet `G...` address
- `walletType`: `external_wallet` or `passkey_smart_account`

Transactions can also store `walletType`, which keeps historical action metadata clear even when the same human user switches between external wallet and passkey modes.

Role-specific flows use the active wallet identity:

- Job creation records the active wallet as the client.
- Job applications record the active wallet as the freelancer.
- Escrow action guards compare the active wallet against escrow role addresses.

## Operational Checklist

For a working local or Testnet setup:

1. Set the Stellar network and RPC variables.
2. Set escrow, reputation, and stablecoin token contract IDs.
3. Set `NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH`.
4. Set `NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID`.
5. Set `NEXT_PUBLIC_APP_DOMAIN` to the browser origin used for development or deployment.
6. Optionally set `NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL`.
7. Restart the web app after changing `NEXT_PUBLIC_*` variables.
8. Clear local passkey session storage after changing smart account WASM hash, verifier, or RP ID.
9. Create or reconnect the passkey smart account.
10. Ensure the fee path is ready: relayer configured or classic SDK source account funded.
11. Ensure the smart account has enough stablecoin/token balance before funding escrow.

## Troubleshooting

### "Passkey approval was cancelled"

The browser/device WebAuthn prompt was dismissed, timed out, or failed user verification. Retry and complete the passkey prompt.

### "Reconnect your passkey smart account to continue"

The SDK has no active session for the selected smart account. Use reconnect and choose the intended smart account if multiple accounts are discovered.

### "The selected passkey is not linked to smart account ..."

The browser returned a credential that does not own the requested smart account. Reconnect with the passkey that created or controls that account.

### "Smart account transaction fees are not configured"

No usable relayer or funded classic source account is available. Configure `NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL` or fund the SDK source account on the selected network.

### "Connected passkey smart account is not compatible ..."

The connected smart account was deployed from a different WASM hash than the currently configured artifact. Use the configured hash, restart the app, clear local passkey session storage, and create or reconnect a compatible smart account.

### "The authenticated passkey is not an active signer"

The credential exists in the browser, but the selected smart account does not list it as an active external signer. Select the correct smart account or create a new account with the current passkey.

### Create transaction succeeded but no escrow ID was returned

This is expected for some smart account wrapper returns. Highrable recovers the escrow ID from on-chain state by scanning the new escrow ID range and matching escrow fields.

## Security Notes

- The app never stores passkey private key material.
- The WebAuthn challenge is derived from the Soroban authorization payload and context rule IDs.
- `allowCredentials` restricts WebAuthn approval to the authenticated credential.
- The connected signer verifier must match the configured WebAuthn verifier contract.
- The connected account's on-chain WASM hash must match the configured account WASM hash.
- External wallets must not be treated as signers for a smart account identity unless the smart account explicitly supports that signer.
- Passkey smart account addresses are contract addresses. Do not pass them to APIs that require classic source account addresses.

## Future Cleanup Opportunities

- Remove compatibility fallback code when `smart-account-kit` exposes the needed AuthPayload and context-rule behavior directly.
- Add integration tests for context-rule resolution and escrow ID recovery.
- Add telemetry around selected context rule IDs and signer matching.
- Move passkey error classification into a shared typed error module.
- Add a relayer setup guide once the production relayer path is finalized.
