---
type: module
area: wallet
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Wallets and Passkeys

## Purpose

Connect external Stellar wallets, create/restore/reconnect passkey smart accounts, persist wallet identity, and route signing to the correct transaction path.

## Current Status

Both identity modes are implemented. Passkey escrow execution is compatibility-sensitive and deployment metadata is not complete for production smart-account operation.

## Primary Locations

- `apps/web/core/wallet/`
- `apps/web/core/passkeys/`
- `apps/web/core/stellar/smart-account-kit.ts`
- `apps/web/core/stellar/passkeySmartAccountExecutor.ts`
- `apps/web/core/stellar/transactionExecutor.ts`
- `apps/web/core/wallet/passkey-smart-account-context.tsx`
- `apps/web/core/wallet/auth/stellar-auth-service.ts`

## Responsibilities

- Connect/persist external wallet sessions through Stellar Wallets Kit.
- Detect network/funding and use Friendbot only for testnet account funding.
- Create, silently restore, reconnect, and choose among discovered smart accounts.
- Persist `walletType` and active address to Convex.
- Validate WebAuthn support, RP ID, signer membership, configured verifier, account WASM hash, and fee path.

## Main Entry Points

`useHighrableWalletIdentity`, `WalletContextProvider`, `PasskeySmartAccountProvider`, `getSmartAccountKit`, `connectFreshPasskeySmartAccount`, and `executeWithPasskeySmartAccount`.

## Data Model

`users.walletAddress` plus optional `walletType` preserves product identity. `transactions` may also store `walletType`, `feePath`, and `sourceAccount` for historical action metadata.

## External Dependencies

Stellar Wallets Kit, `smart-account-kit`, WebAuthn browser APIs, Stellar RPC/Horizon, and optional relayer/channels services.

## Internal Dependencies

Auth cookies, Convex users, escrow helpers, payment assets, smart-account readiness, and transaction records.

## Important Flows

See [[stellar/Smart Accounts and Passkeys]] for the complete external/passkey execution sequences.

## Common Change Locations

Identity selection: `use-highrable-wallet-identity.ts`; external connection: wallet client/context; passkey storage/config: `smart-account-kit.ts` and `smart-account-config.ts`; contract execution: `transactionExecutor.ts` and `passkeySmartAccountExecutor.ts`.

## Risks / Gotchas

- A `C...` address is a contract account and is not a classic RPC source account.
- Changing WASM hash, verifier, or RP ID may require clearing namespaced local session storage and reconnecting.
- Browser wallet connection state is not a substitute for signed backend authorization.

## Related Notes

[[stellar/Wallet Identity Model]], [[stellar/Smart Accounts and Passkeys]], [[architecture/Authentication Boundaries]]
