# Passkey Smart Accounts

Phase 21 adds passkey smart account onboarding for Highrable identity. A passkey smart account can create off-chain jobs, apply to work, edit its profile, and load dashboards by using the smart account contract address as the marketplace wallet address.

Escrow transaction execution is not enabled for passkeys in this phase. Freighter and WalletConnect remain the signing path for create, fund, submit, approve, cancel, and dispute escrow transactions.

## External Wallet vs Passkey Smart Account

- External Wallet: Freighter or WalletConnect account. Can sign escrow transactions and use Friendbot on Stellar testnet.
- Passkey Smart Account: Stellar smart account secured by WebAuthn. Used as Highrable off-chain identity in Phase 21.

## Required Environment Variables

```bash
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH=
NEXT_PUBLIC_WEBAUTHN_VERIFIER_CONTRACT_ID=
NEXT_PUBLIC_PASSKEY_RP_NAME=Highrable
```

Missing smart account config disables only the passkey UI. The rest of the app and external wallet flow continue to work.

## Create

Open a wallet area that shows the passkey card and choose `Create Passkey Account`. The browser or device prompts for a passkey. On success, `smart-account-kit` deploys the smart account with `autoSubmit: true`, stores the session through IndexedDB, and Highrable stores the contract address with `walletType = "passkey_smart_account"`.

## Reconnect and Restore

On page load, Highrable calls the SDK silent restore path. If no session is stored, nothing is shown as an error. `Reconnect Passkey Account` prompts for passkey selection and reconnects the smart account.

## Limitations

- Passkey escrow transaction execution is intentionally disabled.
- Friendbot funding remains external-wallet-only. Passkey smart account funding is handled separately by the SDK and will be improved later.
- Browser support depends on WebAuthn and the user device authenticator.
- Wallet-address trust is still MVP-level. The backend has TODOs to replace wallet address trust with signed wallet session/auth.

## Future Phases

- Phase 22: passkey escrow transaction execution and funding UX.
- Phase 23: policy, spending limit, recovery, multisig, and session key design.
