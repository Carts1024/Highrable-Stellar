---
type: runbook
area: operations
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Deployment

## Contract deployment

The root scripts expose:

- `pnpm contracts:build` → `cd contracts && stellar contract build`.
- `pnpm contracts:deploy:testnet` → testnet wrapper around `scripts/deploy-contracts.sh`.
- `pnpm contracts:deploy:mainnet` → guarded mainnet wrapper.
- `pnpm contracts:verify:testnet` → `scripts/verify-testnet.sh`.

`deploy-contracts.sh` validates the network/endpoints/deployer identity/public platform admin, builds both contracts, estimates fees, uploads/deploys WASM, initializes and wires reputation/escrow, optionally allowlists configured token contracts, verifies wiring, and writes a deployment artifact.

## Mainnet guardrails

`scripts/deploy-mainnet.sh` requires `MAINNET_DEPLOY_CONFIRM=deploy-highrable-mainnet`, HTTPS RPC/Horizon endpoints, and non-testnet-looking URLs before delegating to the shared script. Deployment identities are Stellar CLI identity names; the script rejects a raw secret key in `DEPLOYER`.

Do not run a deployment command as a documentation validation step. It changes external network state and requires an explicit operator decision and verified credentials.

## Testnet verification

`scripts/verify-testnet.sh` checks the authorized escrow contract in reputation, the linked reputation contract, platform admin, initial next escrow ID, and configured asset allowlists. It uses `deployments/testnet.json` as a fallback for public IDs and admin metadata.

## Web/backend release

The web package has `build`, `start`, and `dev` scripts. The backend package has Convex `dev` and dashboard scripts. Hosting/provider deployment configuration is not fully documented in this repository.

`deployments/testnet.json` and `deployments/mainnet.json` are public deployment records, not secrets. The smart-account deployment records are placeholders and do not establish passkey artifact deployment or audit status.

See [[contracts/Deployment Artifacts]], [[stellar/Network Configuration]], and [[stellar/Mainnet Readiness and Relayers]].

## Status

Status: Production hosting/release automation is not documented yet. The repository documents contract deployment scripts and readiness checks, but not a complete application CI/CD or rollback runbook.
