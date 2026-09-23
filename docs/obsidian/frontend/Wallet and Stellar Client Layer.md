---
type: architecture
area: frontend
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Wallet and Stellar Client Layer

## Core files

- `apps/web/core/wallet/context/wallet-context.tsx`: external wallet state, connection, funding checks, Friendbot, auth session.
- `apps/web/core/wallet/clients/stellar-wallet-kit-client.ts`: Stellar Wallets Kit adapter.
- `apps/web/core/wallet/auth/stellar-auth-service.ts`: challenge/verify client.
- `apps/web/core/wallet/passkey-smart-account-context.tsx`: passkey account lifecycle and active state.
- `apps/web/core/stellar/transaction.ts`: RPC simulation, prepared transaction signing, submission, polling, readable errors.
- `apps/web/core/stellar/transactionExecutor.ts`: dispatches by wallet mode.
- `apps/web/core/stellar/escrow-contract.ts`: argument encoding and escrow method wrappers.
- `apps/web/core/stellar/payment-assets.ts`, `stablecoin-config.ts`, `path-payments.ts`, `trustline.ts`: payment asset/readiness logic.

## Execution dispatcher

```text
executeHighrableContractCall
  ├── external_wallet → invokeContract → signTransaction callback → RPC
  └── passkey_smart_account → executeWithPasskeySmartAccount
                              → smart-account execute + WebAuthn
                              → relayer/source account → RPC
```

External `invokeContract` gets a classic source account, prepares the transaction through RPC, calls the wallet signer, sends the signed XDR, then polls up to 18 attempts with 1.5-second delays. Passkey execution builds an outer smart-account execute transaction and reads the inner return value after confirmation.

## Read behavior

Soroban simulations require an RPC source account. With a `C...` product identity, the escrow helper resolves a classic SDK/deployer public key for reads. This source account is not automatically the passkey actor and should not be written into user identity fields.

## Amounts and hashes

Feature inputs use human asset amounts. Helpers convert to token units using configured decimals (default stablecoin decimals are 7 if not overridden). Contract `BytesN<32>` arguments are encoded from exactly 32 bytes; backend proof hashes are lowercase SHA-256 hex.

## Change guidance

When adding a contract method, update the Rust contract, frontend wrapper, executor argument encoding, transaction bookkeeping, and any Convex mirror transition. Test both wallet modes or explicitly mark a path unsupported.

See [[stellar/Transaction Lifecycle]], [[stellar/Wallet Identity Model]], and [[stellar/Payment Assets and Path Payments]].
