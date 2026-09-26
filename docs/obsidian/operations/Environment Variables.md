---
type: reference
area: operations
status: current
last_updated: 2026-09-26
source_of_truth: repository
---

# Environment Variables

The authoritative schemas are `apps/web/core/config/env.ts`, `apps/web/.env.example`, and `packages/backend/.env.example`. This note documents names and roles only; values belong in ignored local/secret configuration.

## Public web configuration

| Group | Variables |
| --- | --- |
| Network | `NEXT_PUBLIC_STELLAR_NETWORK`, `NEXT_PUBLIC_STELLAR_RPC_URL`, `NEXT_PUBLIC_STELLAR_HORIZON_URL`, `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` |
| Convex/app | `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_WAITLIST_MODE`, `NEXT_PUBLIC_ENABLE_HIGHRABLE_DEBUGGER` |
| Optional Velo feature flag | `NEXT_PUBLIC_ENABLE_VELO_GAS_STATION` — must remain false unless the Testnet Velo policy and deployment are verified. |
| Contracts | `NEXT_PUBLIC_ESCROW_CONTRACT_ID`, `NEXT_PUBLIC_REPUTATION_CONTRACT_ID` |
| Assets | `NEXT_PUBLIC_STABLECOIN_ASSET_CODE`, `NEXT_PUBLIC_STABLECOIN_ISSUER`, `NEXT_PUBLIC_USDC_ASSET_CODE`, `NEXT_PUBLIC_USDC_ASSET_ISSUER`, `NEXT_PUBLIC_STABLECOIN_SYMBOL`, `NEXT_PUBLIC_STABLECOIN_DECIMALS`, `NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID`, `NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID` |
| Wallets | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` |
| Smart accounts | `NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH`, `NEXT_PUBLIC_SMART_ACCOUNT_FACTORY_CONTRACT_ID`, `NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_LABEL`, `NEXT_PUBLIC_SMART_ACCOUNT_DEPLOYMENT_VERSION`, `NEXT_PUBLIC_SMART_ACCOUNT_SOURCE_REPO`, `NEXT_PUBLIC_SMART_ACCOUNT_WASM_SHA256`, `NEXT_PUBLIC_WEBAUTHN_VERIFIER_WASM_SHA256`, `NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID`, `NEXT_PUBLIC_PASSKEY_RP_NAME`, `NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL`, `NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND` |

## Server-only configuration

- `WALLET_SESSION_SECRET` signs challenge/session cookies.
- `HIGHRABLE_ADMIN_WALLET_ADDRESS` selects the configured admin public wallet.
- `HIGHRABLE_ADMIN_CONVEX_SECRET` protects server-to-Convex admin calls.
- `SMART_ACCOUNT_RELAYER_PRIVATE_KEY` and `SMART_ACCOUNT_RELAYER_PUBLIC_KEY` support a configured relayer path.
- `SMART_ACCOUNT_CHANNELS_API_KEY` supports the channels relayer integration when selected.
- `SMART_ACCOUNT_ALLOWED_TARGET_CONTRACTS`, `SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_TX`, `SMART_ACCOUNT_MAX_SPONSORED_FEE_PER_ACCOUNT_DAILY`, and `SMART_ACCOUNT_RELAY_RATE_LIMIT_PER_MINUTE` constrain relayer policy.
- `VELO_GAS_API_KEY` is a gas-scoped Testnet key and `VELO_BASE_URL` is the exact Velo deployment URL. They are used only by the Node gas routes and must never be `NEXT_PUBLIC_*`, placed in browser storage, logged, or returned in API responses.

Before enabling the Velo flag, an operator must verify the Testnet policy is enabled with a positive cap/quota, every target contract is allowlisted, the relayer is active and funded, the configured public relayer matches the signer, and the key is scoped to gas operations. This repository does not invent or verify those credentials or live provider settings.

Convex chain reads use server-side names such as `STELLAR_NETWORK`, `STELLAR_RPC_URL`, `STELLAR_NETWORK_PASSPHRASE`, `ESCROW_CONTRACT_ID`, `REPUTATION_CONTRACT_ID`, and `STELLAR_READ_SOURCE_ACCOUNT` as defined by `packages/backend/convex/lib/stellarReads.ts`.

## Precedence and drift

The root `package.json` is the executable package-manager authority (`pnpm@12.5.1`). `README.md` still says pnpm `11.1.2`; `GEMINI.md` also contains older Node/pnpm guidance. Use the root manifest and current package schemas when instructions disagree.

See [[stellar/Network Configuration]], [[operations/Security and Secrets]], and [[operations/Local Development]].
