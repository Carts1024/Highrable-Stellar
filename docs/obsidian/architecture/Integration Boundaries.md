---
type: architecture
area: integrations
status: current
last_updated: 2026-09-26
source_of_truth: repository
---

# Integration Boundaries

| Integration | Used for | Boundary and failure mode |
| --- | --- | --- |
| Convex | Product state, real-time queries/mutations, storage, workflow records, and Resend component wiring. | Browser uses typed API; Convex state may lag chain state when sync actions fail. |
| Stellar RPC | Soroban simulation, transaction preparation, submission, confirmation, and contract reads. | Requires network passphrase, RPC URL, valid source account, and contract IDs. |
| Horizon | Classic account loading, trustline readiness, XLM balances, path-payment quotes/submission, and transaction confirmation. | It is not used as a historical indexer by current backend code. |
| Stellar Wallets Kit | External-wallet connection, transaction signing, and message signing. | Produces classic `G...` wallet identity. |
| `smart-account-kit` | Passkey smart-account creation, restore, contract discovery, session storage, and mediated execution support. | Current app has compatibility code for SDK/binding/account ABI differences. |
| WebAuthn | Passkey approval for smart-account authorization. | RP ID must match the app domain; device/browser support and configured verifier matter. |
| Resend | Backend waitlist email component. | Configuration is in `packages/backend/convex/convex.config.ts`; credentials stay server-side. |
| Stellar Explorer URLs | Human-readable links stored alongside transaction records. | Links are metadata, not proof that a Convex record was successfully synchronized. |
| Velo Gas Station | Testnet fee sponsorship for opt-in external-wallet Soroban calls. | Browser sends one wallet-signed inner XDR to authenticated Node routes; the API key, exact deployment URL, policy/allowlist/quota, relayer, and recovery calls stay server-side. |

## Absent boundaries

- No separate public backend API gateway for ordinary product operations.
- No dedicated chain indexer or event consumer.
- No in-repository general relayer service; Velo is a bounded external Testnet sponsorship integration and readiness code still validates the separate passkey/custom/managed fee paths.
- No contract event emission in the current escrow or reputation source.

Related: [[architecture/Architecture Overview]], [[stellar/Stellar Integration]], [[modules/Sync and Transactions]].
