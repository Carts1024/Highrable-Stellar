---
type: architecture
area: stellar
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Stellar and Wallet Architecture

Highrable has two product wallet identity modes:

| Mode | Product identity | Transaction actor | Typical fee/source path |
| --- | --- | --- | --- |
| `external_wallet` | Classic Stellar `G...` account | The same classic account | Stellar Wallets Kit signs a prepared transaction; the classic source account pays fees. |
| `passkey_smart_account` | Soroban smart-account `C...` contract address | The smart-account contract invokes the target contract | A configured relayer or a classic SDK/deployer/source account pays/builds the transaction; WebAuthn authorizes the smart-account invocation. |

Do not pass a `C...` smart-account address to code that requires a classic source account. `resolveReadSourceAddress` uses the configured SDK/deployer public key for read simulations when needed.

## External-wallet execution

```text
feature hook
  → apps/web/core/stellar/escrow-contract.ts
  → transactionExecutor.ts
  → transaction.ts / invokeContract
  → Stellar Wallets Kit sign callback
  → Stellar RPC submission and confirmation polling
```

## Passkey smart-account execution

```text
feature hook
  → escrow-contract.ts
  → transactionExecutor.ts
  → passkeySmartAccountExecutor.ts
  → smart-account execute(...) around the target contract call
  → context-rule lookup and WebAuthn approval
  → relayer or classic source-account submission
```

The passkey signer is a WebAuthn credential validated by the smart-account/WebAuthn verifier configuration. The browser does not receive a seed phrase or passkey private key.

## Important identity distinctions

- Product identity is what Convex stores in `walletAddress` plus `walletType`.
- Transaction actor is the address supplied to Soroban authorization arguments.
- RPC simulation source account is the classic account needed by the RPC transaction builder.
- Fee payer is either the external wallet, a classic source account, or a relayer depending on execution mode.
- Passkey signer is the WebAuthn credential, not the `C...` address itself.
- WebAuthn verifier is a configured Soroban contract address checked against the connected signer.

See [[stellar/Wallet Identity Model]], [[stellar/Smart Accounts and Passkeys]], and [[stellar/Transaction Lifecycle]].
