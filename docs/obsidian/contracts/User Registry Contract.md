---
type: contract
area: identity
status: current
last_updated: 2026-10-18
source_of_truth: repository
---

# User Registry Contract

## Purpose and scope

`contracts/registry` provides public, self-authorized registration for Highrable wallet identities. It stores only the wallet address and immutable registration timestamp. Registration is not Highrable approval, KYC, or identity verification. Anyone can invoke the contract directly; the wallet supplied as `user` must authorize the call.

The v1 contract has no administrator, profile fields, counters, listing API, deletion, or upgrade mechanism. Profiles and onboarding state remain in Convex.

## Interface and storage

| Method | Behavior |
| --- | --- |
| `register(user)` | Requires `user.require_auth()` on every call. Stores the current ledger timestamp on first registration. Duplicate calls return the original record without changing its timestamp or emitting another event. |
| `get_registration(user)` | Returns the address and timestamp, or `None`. |
| `is_registered(user)` | Returns whether the persistent registration key exists. |

Persistent records are keyed by address and contain `{ address, registered_at }`. Every entry point extends the contract instance TTL; accessing an existing record extends its persistent TTL. The current threshold is 100 ledgers and the extension target is 518,400 ledgers.

First registration emits a v1 event with topics `registry`, `registered_v1`, and the wallet address; the timestamp is event data. Duplicate calls emit no second event.

## Signup integration

`saveProfileDraft` applies existing profile sanitization, public-handle uniqueness, and avatar validation without setting `onboardingCompletedAt`. `syncUserRegistration` independently reads the configured registry through Stellar RPC, validates `get_registration` against `is_registered`, and invokes the internal scoped mirror mutation. New `completeOnboarding` calls require both a valid saved profile and a mirror row matching the configured network, contract, and wallet. Existing completion timestamps are preserved before any registry configuration check.

Pending signup transaction recovery reads transaction status with RPC `getTransaction`. Stellar RPC serializes `latestLedgerCloseTime` and `oldestLedgerCloseTime` as decimal Unix-time strings, while the installed Stellar SDK types these fields as numbers and passes through the response values. The browser normalizes either safe integer numbers or decimal strings before applying the existing retained-history expiry rule; malformed or unsafe times still fail closed.

The sync action is permissionless because it records public chain state. It does not authenticate its caller or accept profile changes. Transaction hashes and client callbacks are optional bookkeeping; they are not proof of membership. The mirror is keyed by network/contract/wallet and preserves the chain registration time plus last verification time.

External wallets register their classic `G...` address. Passkey accounts register their `C...` contract address; the classic source account and fee payer remain separate transaction roles.

## Configuration and operations

The web app uses `NEXT_PUBLIC_REGISTRY_CONTRACT_ID`. Convex uses `REGISTRY_CONTRACT_ID`, `STELLAR_NETWORK`, `STELLAR_RPC_URL`, and `STELLAR_READ_SOURCE_ACCOUNT`; local network reads also require an explicit `STELLAR_NETWORK_PASSPHRASE`. Registry reads do not require escrow or reputation contract IDs. Browser/backend network and contract scopes must match.

`scripts/deploy-registry.sh` builds and deploys only this contract and writes a separate `deployments/registry-<network>.json`. `scripts/verify-registry.sh` performs read-only membership and record calls. The deployment script was not run for this change, so no deployed ID or live behavior is established.

## Validation

`contracts/registry/src/test.rs` covers first registration, immutable duplicates, distinct/missing records, missing and mismatched authorization, contract-account authorization, event uniqueness, and instance/persistent TTL extension. `apps/web/core/stellar/registry-contract.test.ts` covers missing transaction recovery with both the SDK's numeric typing and RPC's string wire timestamps. These tests and a WASM build establish local source behavior only.

## Related notes

[[modules/Profiles and Reputation]], [[data/State Machines]], [[modules/Sync and Transactions]], [[stellar/Wallet Identity Model]], [[operations/Deployment]]
