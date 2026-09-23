---
type: reference
area: stellar
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Wallet Identity Model

Highrable has two transaction identity modes. The address used to describe a person or role is not always the address that pays fees, signs an authorization entry, or supplies the RPC source account.

| Concept | External wallet | Passkey smart account |
| --- | --- | --- |
| Product wallet identity | Classic Stellar public key beginning with `G` | Soroban contract account beginning with `C` |
| Main signer | Connected wallet extension/provider | WebAuthn credential through the smart-account kit |
| Contract actor | Usually the same classic `G` address | The smart-account `C` address; auth is produced by the passkey signer/verifier path |
| Fee/source path | External wallet transaction source | Configured relayer or classic SDK/deployer/source-account fallback, subject to readiness checks |
| Convex user link | Wallet address and wallet type | Persisted passkey smart-account identity and wallet type |

## Address roles to keep separate

- **Product participant:** client or freelancer recorded in Convex and/or the escrow contract.
- **Transaction actor:** address passed to a contract method and checked by the contract.
- **RPC source account:** account used to build/simulate the transaction.
- **Fee payer:** account or relayer that supplies fees.
- **Passkey signer:** WebAuthn credential that signs smart-account authorization.
- **Verifier:** configured WebAuthn verifier contract used by the smart account.

Confusing these roles can produce simulation failures that look like application authorization failures. The executor and readiness checks intentionally inspect them separately.

## Authentication versus transaction signing

External-wallet challenge/verify authentication creates a server session for HTTP/admin use. Signing a Soroban transaction authorizes a chain operation. They are related user actions but are not interchangeable proofs.

The backend still has explicit TODOs to replace caller-supplied wallet arguments with signed-session/auth enforcement for several public mutations. Do not treat a `walletAddress` argument alone as proof of key possession.

See [[architecture/Authentication Boundaries]], [[stellar/Smart Accounts and Passkeys]], and [[modules/Wallets and Passkeys]].
