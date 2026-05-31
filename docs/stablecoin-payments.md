# Stablecoin Payments

Highrable's MVP escrow flow uses a Soroban token contract for payments. Native XLM is still needed
for Stellar testnet fees, but it is not the escrow payment asset.

## Required frontend configuration

Set these values in `apps/web/.env.local`:

- `NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID`: the Soroban token contract used for escrow payments.
- `NEXT_PUBLIC_STABLECOIN_SYMBOL`: the user-facing symbol shown in the UI, such as `Mock USDC`.
- `NEXT_PUBLIC_STABLECOIN_DECIMALS`: token decimals used when converting between raw units and
  human display amounts.

## What the UI checks

- Job creation uses the configured token contract as the default payment asset.
- Escrow funding is disabled if the job asset does not match the configured stablecoin contract.
- Stablecoin balances are read from the configured token contract before funding escrow.
- Amounts shown in the UI stay in human units while on-chain calls use token raw units.
- In passkey smart-account mode, balances are checked for the smart account contract address, not the external wallet address.

## Friendbot and testnet funding

Friendbot only funds testnet XLM for account activation and transaction fees. It does not fund the
escrow stablecoin. For demos, make sure the client wallet has:

- testnet XLM for fees
- the configured stablecoin balance for the escrow amount

For passkey smart-account demos, make sure the smart account has the configured stablecoin balance. Transaction fees also need either a configured smart-account relayer or a funded SDK source account. See `passkey-smart-accounts.md`.

## Legacy trustline support

Classic Stellar trustlines are treated as background infrastructure in this MVP. The primary
payment-readiness path is based on the configured token contract, wallet balance, job asset match,
and Stellar testnet fee funding.
