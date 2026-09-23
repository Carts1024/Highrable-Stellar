---
type: policy
area: operations
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Security and Secrets

## Never commit

- Stellar secret keys, seed phrases, or raw deployment identity secrets.
- `WALLET_SESSION_SECRET` values.
- `HIGHRABLE_ADMIN_CONVEX_SECRET` values.
- Relayer private keys, channels API keys, or provider tokens.
- Unredacted local `.env` files or user credential exports.
- Private attachment/proof contents in documentation.

Environment variable names, public contract IDs, classic public keys, and documented placeholder values may be described when needed for operation. Secret values must remain in the local secret manager/ignored env file.

## Trust boundaries

- Browser `NEXT_PUBLIC_*` configuration is public and must not contain credentials.
- Stellar transaction signatures prove a chain action; they do not automatically create a server session.
- The signed HTTP-only wallet session protects the Next server route boundary.
- Convex admin functions independently require the configured admin wallet and Convex secret.
- Participant mutations that still accept caller-supplied wallet addresses need signed-session/auth hardening; see [[architecture/Authentication Boundaries]].

## Deployment hygiene

- Use Stellar CLI identity names, not secret keys, with deployment scripts.
- Verify network/passphrase/RPC/Horizon and contract IDs before signing.
- Treat relayer fee sponsorship as privileged infrastructure: restrict target contracts, rate, fee, account, and daily budget.
- Check public deployment artifacts for accidental secrets before committing.

## Known gaps

The repository documents incomplete signed-session enforcement across public Convex mutations, incomplete attachment/content checksums, no general event indexer, and no production relayer audit. These are release risks, not merely documentation gaps.

See [[operations/Environment Variables]], [[operations/Deployment]], and [[stellar/Mainnet Readiness and Relayers]].
