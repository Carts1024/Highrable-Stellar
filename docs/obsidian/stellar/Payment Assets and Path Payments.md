---
type: reference
area: stellar
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Payment Assets and Path Payments

## Escrow assets

`apps/web/core/stellar/payment-assets.ts` exposes two configured asset kinds:

- **Stablecoin:** primary, non-volatile, configured from `NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID`; the token value may be a Soroban contract ID or a classic issuer that is converted to the corresponding SAC contract ID.
- **Native XLM:** optional, volatile, seven decimals, configured from `NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID`.

The escrow UI only accepts assets that pass `requireSupportedEscrowAsset`. Stablecoin decimals default to 7 but are configurable between 0 and 18 after validation. Amount conversion must use integer token units.

## Classic USDC onboarding

`apps/web/core/stellar/trustline.ts` checks the classic account on Horizon and builds/submits a `changeTrust` transaction when a trustline is missing. The account needs enough XLM for the reserve and transaction fee. The helper is currently written around the configured/testnet USDC asset constants and reports testnet-oriented errors.

## XLM-to-USDC top-up

`apps/web/core/stellar/path-payments.ts` quotes and executes a Horizon strict-receive path payment from XLM to classic USDC. It checks spendable XLM/reserves/fees, requires the classic USDC trustline, and enforces a maximum configured slippage of 5%. This is a classic-account top-up flow, not an escrow contract method.

## Configuration pitfalls

- A classic issuer (`G...`) and a Soroban token contract (`C...`) are different identifiers; `stablecoin-config.ts` derives the SAC contract ID for the former.
- The escrow contract's asset allowlist is independent of a user's trustline or balance.
- XLM escrow is unavailable when the native XLM token contract is not configured.
- Network/passphrase/Horizon/RPC mismatches can make a valid asset appear unavailable.

See [[modules/Escrow and Payments]], [[stellar/Network Configuration]], and [[operations/Environment Variables]].
