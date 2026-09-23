---
type: reference
area: stellar
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Network Configuration

`apps/web/core/config/env.ts` validates the client/server environment. Supported network labels are `local`, `testnet`, `mainnet`, and `public`.

## Core variables

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Logical network label. |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Soroban RPC endpoint. |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | Classic Stellar Horizon endpoint. |
| `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` | Transaction/build and contract-read network identity. |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | Escrow contract address. |
| `NEXT_PUBLIC_REPUTATION_CONTRACT_ID` | Reputation contract address. |
| `NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID` | Stablecoin contract ID or classic issuer input. |
| `NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID` | Optional XLM token contract used for escrow. |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL. |
| `NEXT_PUBLIC_APP_DOMAIN` | App origin/RP-ID source and production domain check. |

The client schema supplies testnet/local development defaults for some endpoints and passphrases. Production/mainnet domains are required to be HTTPS-compatible by the readiness/configuration checks. Do not copy development defaults into production without verifying every endpoint and passphrase.

## Smart-account variables

The smart-account path additionally reads `NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH`, `NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID`, optional factory/deployment metadata, `NEXT_PUBLIC_PASSKEY_RP_NAME`, `NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_URL`, and `NEXT_PUBLIC_SMART_ACCOUNT_RELAYER_KIND`. See [[stellar/Smart Accounts and Passkeys]].

## Server-only variables

`WALLET_SESSION_SECRET`, `HIGHRABLE_ADMIN_WALLET_ADDRESS`, `HIGHRABLE_ADMIN_CONVEX_SECRET`, and relayer private/API/rate-limit settings are server-only. Their names may be documented; their values must never be committed.

## Consistency rule

RPC URL, Horizon URL, passphrase, contract IDs, asset IDs, wallet network, and deployment artifact must refer to the same network. `mainnet-readiness.ts` and `relayer-readiness.ts` perform consistency checks, but operators remain responsible for reviewing the actual environment.

See [[operations/Environment Variables]], [[operations/Security and Secrets]], and [[contracts/Deployment Artifacts]].
