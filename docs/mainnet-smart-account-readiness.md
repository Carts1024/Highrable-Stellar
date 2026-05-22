# Mainnet Smart Account Readiness

Phase 25 adds a configuration and operational readiness gate for Highrable passkey smart-account escrow execution on Stellar mainnet. It checks network selection, RPC/Horizon consistency, passkey domain configuration, smart-account deployment metadata, WebAuthn verifier configuration, relayer/channel fee paths, and payment asset settings.

Mainnet readiness checks reduce configuration risk. They do not replace audits, monitoring, incident response, or legal/compliance review.

## What This Does Not Guarantee

This phase does not make Highrable fully production-audited. It does not replace Soroban contract audits, relayer audits, backend auth hardening, dispute workflow hardening, monitoring, incident response, or legal/compliance review.

## Required Public Env Vars

- `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`
- `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015`
- `NEXT_PUBLIC_STELLAR_RPC_URL`
- `NEXT_PUBLIC_STELLAR_HORIZON_URL`
- `NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH`
- `NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID`
- `NEXT_PUBLIC_APP_DOMAIN=https://highrable.work`
- `NEXT_PUBLIC_PASSKEY_RP_NAME`
- `NEXT_PUBLIC_ESCROW_CONTRACT_ID`
- `NEXT_PUBLIC_REPUTATION_CONTRACT_ID`
- `NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID`
- `NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID` if XLM escrow is enabled
- `NEXT_PUBLIC_USDC_ASSET_CODE`
- `NEXT_PUBLIC_USDC_ASSET_ISSUER`
- `NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND`
- `NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL` when using `custom` or `openzeppelin_channels`

Optional public metadata:

- `NEXT_PUBLIC_SMART_ACCOUNT_FACTORY_CONTRACT_ID`
- `NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_LABEL`
- `NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_VERSION`
- `NEXT_PUBLIC_SMART_ACCOUNT_SOURCE_REPO`
- `NEXT_PUBLIC_SMART_ACCOUNT_WASM_SHA256`
- `NEXT_PUBLIC_WEBAUTHN_VERIFIER_WASM_SHA256`

## Required Private Env Vars

- `SMART_ACCOUNT_RELAYER_PRIVATE_KEY` for a self-hosted custom relayer
- `SMART_ACCOUNT_RELAYER_PUBLIC_KEY`
- `SMART_ACCOUNT_CHANNELS_API_KEY` for OpenZeppelin Channels
- `SMART_ACCOUNT_ALLOWED_TARGET_CONTRACTS`
- `SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_TX`
- `SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_ACCOUNT_DAILY`
- `SMART_ACCOUNT_RELAY_RATE_LIMIT_PER_MINUTE`

Never prefix private relayer credentials with `NEXT_PUBLIC_`. The browser must not receive relayer private keys or Channels API keys.

## Mainnet Checklist

- Deploy or verify the smart account contract artifact.
- Deploy or verify the WebAuthn verifier contract.
- Fill `deployments/smart-accounts/mainnet.json`.
- Configure the production HTTPS app domain.
- Confirm the RP ID derives from the production domain.
- Configure the fee path: OpenZeppelin Channels, a hardened custom relayer, or a funded source account fallback.
- Configure allowed target contracts, including the Highrable escrow contract.
- Configure supported escrow assets.
- Verify the classic USDC issuer for Path Payment top-up.
- Run `scripts/verify-smart-account-mainnet.ts`.
- Test with tiny amounts.
- Document rollback and disablement steps.

## Relayer Options

- `none`: no relayer. Passkey execution depends on a funded SDK/source account if available.
- `sdk_source_account`: existing SDK source/deployer account fallback. Allowed, but not preferred for mainnet.
- `custom`: Highrable-operated relayer. It must use HTTPS on mainnet, enforce the selected network, restrict target contracts, simulate before submission, cap fees, rate-limit sponsored transactions, and log hashes/failures.
- `openzeppelin_channels`: preferred managed submission option. OpenZeppelin Relayer with the Channels Plugin can submit Soroban transactions and handle fees, but Highrable must still enforce allowed targets, network consistency, and user authorization.

## Unsupported Legacy Services

Launchtube is legacy and must not be used for new Highrable work. Use OpenZeppelin Relayer with the Channels Plugin instead.

## Known Limitations

- Backend mutation auth still has TODOs.
- Sync is action-driven.
- Dispute resolution is limited.
- Proof privacy controls are incomplete.
- Smart contracts do not emit events yet.
- Contracts are not audited unless separately completed.
- Path Payment top-up depends on liquidity and trustline readiness.
- XLM escrow exposes users to volatility.

## Required Warning

Mainnet readiness checks reduce configuration risk. They do not replace audits, monitoring, incident response, or legal/compliance review.
