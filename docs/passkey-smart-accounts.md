# Passkey Smart Accounts

Highrable supports two wallet identity modes:

- External Wallet: Freighter or WalletConnect account.
- Passkey Smart Account: Stellar smart account secured by WebAuthn through `smart-account-kit`.

## Current Capability Table

| Capability | External Wallet | Passkey Smart Account |
| --- | --- | --- |
| Off-chain identity | Yes | Yes |
| Escrow write transactions | Yes | No, Phase 23 |
| Friendbot fallback | Yes | No/limited |
| Stablecoin balance panel | Yes | Read-only if supported |

## Phase 21: Onboarding Complete

Phase 21 added passkey smart account creation and reconnect for Highrable identity. A passkey smart account can create off-chain jobs, apply to jobs or milestones, edit profiles, and load dashboards using the smart account contract address as the marketplace wallet address.

Creation uses the installed `smart-account-kit` API:

- `createWallet(appName, userName, { autoSubmit: true, ... })`
- `connectWallet()` for silent restore
- `connectWallet({ prompt: true })` for user-prompted reconnect

The app stores passkey sessions through IndexedDB when available, with a localStorage fallback, and records the smart account address in Convex with `walletType = "passkey_smart_account"` when a user record can be linked.

## Phase 22: Readiness Features

Phase 22 improves readiness and UX before enabling escrow writes:

- Silent session restore on client load without repeated WebAuthn prompts.
- Recoverable warning when local passkey storage cannot be restored.
- Reconnect Passkey and Clear local passkey session controls.
- Smart account address and wallet type display.
- Passkey readiness checklist.
- Read-only balance checks where the address type can be queried safely.
- Convex user linkage diagnostics.
- Wallet mode switching between External Wallet and Passkey Smart Account.
- Escrow guard messaging that clearly explains why passkey signing is disabled.
- Profile and public proof wallet type badges.

## What Passkey Smart Accounts Can Do Now

Passkey smart accounts can be used as a Highrable off-chain identity:

- Create off-chain jobs.
- Apply to jobs.
- Apply to milestones.
- Edit freelancer and client profiles.
- Load freelancer/client dashboards.
- Appear on profile and public proof pages as `Wallet type: Passkey Smart Account`.

This badge is not an identity verification badge.

## What They Cannot Do Yet

Passkey smart accounts cannot sign escrow write transactions in Phase 22. The following actions remain external-wallet-only:

- Create Escrow
- Fund Escrow
- Submit Work
- Approve and Release
- Cancel Escrow
- Mark Disputed

Reason shown in the app:

> Passkey escrow signing is not enabled yet. Switch to Freighter or WalletConnect to perform this action.

## Why Escrow Writes Are Disabled

The current passkey implementation is ready for identity, diagnostics, and read-only checks. Escrow write execution needs a separate Phase 23 implementation so transaction assembly, signing, sponsorship/funding, and contract auth behavior can be tested without risking the existing Freighter and WalletConnect escrow path.

## Wallet Mode Switching

If only an external wallet is connected, Highrable uses External Wallet mode. If only a passkey smart account is connected, Highrable uses Passkey Smart Account mode. If both are connected, the user can choose the active identity.

Off-chain marketplace actions use the active identity. Escrow write actions only work in External Wallet mode until Phase 23.

## Friendbot Limitation

Friendbot funds external Stellar testnet accounts. Passkey smart account addresses may be contract IDs, not classic G-addresses, so the app does not reuse external-wallet Friendbot funding for passkey accounts.

The UI states:

> Friendbot funds external Stellar testnet accounts. Passkey smart account funding is handled separately and will be improved before escrow execution.

## Balance Readiness

Phase 22 attempts read-only balance checks only when the address type can be queried safely. If the smart account address is a contract address or the current read path cannot support it, the app shows:

> Balance reading for passkey smart accounts is limited in this phase.

The readiness panel does not fake funding readiness.

## Browser and Device Limitations

Passkey support depends on WebAuthn availability, browser support, device authenticator support, and user platform settings. Unsupported browsers show a readiness warning and do not attempt passkey creation or reconnect.

Silent restore should not trigger a WebAuthn prompt. Prompted reconnect is only started when the user clicks Reconnect Passkey.

## Required Environment Variables

```bash
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH=
NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID=
NEXT_PUBLIC_PASSKEY_RP_NAME=Highrable
```

Missing smart account config disables only passkey smart account features. External wallet connection and escrow execution remain available.

## Security Notes

Wallet-address-based identity is MVP-level and is not production authentication. Backend code keeps TODOs for replacing wallet address trust with signed wallet session/auth.

## Future Phase 23

Phase 23 should implement passkey escrow transaction execution deliberately:

- Wire passkey accounts into escrow write helpers.
- Validate smart account auth entries and transaction simulation.
- Improve funding and fee sponsorship flows.
- Preserve external wallet escrow execution as a supported path.
- Add tests for micro gig and milestone escrow execution through passkey smart accounts.
