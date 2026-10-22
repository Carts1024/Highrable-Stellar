---
type: reference
area: stellar
status: experimental
last_updated: 2026-10-22
source_of_truth: repository
---

# Smart Accounts and Passkeys

Passkey accounts are Soroban contract accounts controlled by a WebAuthn credential. They are a compatibility-sensitive execution mode, not ordinary classic Stellar wallets.

## Configuration

`apps/web/core/stellar/smart-account-config.ts` requires an RPC URL, network passphrase, account WASM hash, WebAuthn verifier contract ID, and an RP ID derived from `NEXT_PUBLIC_APP_DOMAIN`. The current compatibility checks target `smart-account-kit` `0.2.10`, reject a known incompatible WASM hash, and verify that the running hostname matches the RP ID.

`apps/web/core/stellar/smart-account-kit.ts` provides namespaced IndexedDB/localStorage persistence, account discovery/reconnection, credential handling, and active-signer/verifier checks. `passkey-smart-account-context.tsx` creates/restores/reconnects/selects accounts and persists the passkey identity to Convex.

When credential discovery hits a temporary indexer failure, reconnect continues with the SDK's deterministic contract address derivation and `connectWallet` checks that the account exists through RPC. Highrable then reads default context rule `0` on-chain and verifies the authenticated credential and configured WebAuthn verifier. The indexer remains necessary to offer a picker for multiple accounts and to inspect signers that exist only in specialized context rules.

## Execution

The executor handles account preflight, WebAuthn context rules, AuthPayload encoding, authorization-entry signing, and contract submission. It supports passkey versions of the main escrow actions, including create/fund, submit, approve/release, cancel, and mark disputed. Account creation and reconnect validate the default-rule signer directly through RPC when available, so a temporary indexer database failure does not by itself make those flows fail.

## Relayer paths

Readiness code recognizes `none`, `custom`, `openzeppelin_channels`, and `sdk_source_account`. Legacy Launchtube is explicitly unsupported. If no production relayer is configured, the compatibility/source-account path may still exist in code but should not be described as hardened fee sponsorship.

## Tracked deployment status

`deployments/smart-accounts/testnet.json` and `deployments/smart-accounts/mainnet.json` currently contain empty/placeholder artifact, verifier, factory, relayer, and verification metadata. A configured client is not evidence that these artifacts are deployed or audited.

## Change discipline

Changes here can invalidate existing credentials, context rules, account WASM compatibility, or RP ID behavior. Validate on the target network and domain, preserve account recovery behavior, and update [[stellar/Mainnet Readiness and Relayers]] when a compatibility assumption changes.
