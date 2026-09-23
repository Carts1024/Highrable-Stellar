---
type: reference
area: terminology
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Glossary

| Term | Meaning in Highrable |
| --- | --- |
| Classic account | A Stellar account address beginning with `G`. External wallets and fee/source accounts use this form. |
| Smart account | A Soroban contract account beginning with `C`, controlled by a passkey/signer policy. It is not an ordinary wallet keypair. |
| SAC | Stellar Asset Contract: the contract representation used by Soroban token transfers. |
| Escrow | A Soroban record holding client, optional freelancer, asset, amount, hashes, timestamps, and lifecycle status. |
| Job hash | A 32-byte identifier committed by the escrow contract for a job/milestone context. Convex currently stores job hashes as strings and has a TODO about converting to on-chain 32-byte form. |
| Proof hash | A SHA-256 digest for work-submission metadata; the contract stores a `BytesN<32>` proof hash when work is submitted. |
| Reputation record | The immutable Soroban completion record written by the authorized escrow contract after release; Convex also mirrors/display records. |
| Convex mirror | Product-state representation of on-chain or workflow state. It is not automatically authoritative for funds. |
| RPC | Stellar/Soroban JSON-RPC used for transaction preparation, simulation, submission, and contract reads. |
| Horizon | Stellar classic API used for account/balance/trustline and path-payment operations. |
| Source account | A classic `G...` account used to build/simulate/pay transaction fees when the actor is a contract account. |
| Relayer | Optional service or managed channel used to submit/pay for passkey smart-account transactions. |
| RP ID | WebAuthn relying-party identifier derived from `NEXT_PUBLIC_APP_DOMAIN`. |
| Basis points (bps) | Ten-thousandths used by dispute settlement; `10000` means the full escrow amount. |
| Trustline | Classic Stellar authorization for receiving a non-native asset such as the configured USDC asset. |
| Path payment | A Horizon/ Stellar operation that converts XLM into the configured classic USDC asset along an available liquidity path. |
| On-chain sync | An action-driven Convex read of Soroban state followed by an internal mutation that safely updates the Convex mirror. |
| Wallet identity | The product-level address plus `walletType`, either `external_wallet` or `passkey_smart_account`. |
