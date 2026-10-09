---
type: runbook
area: operations
status: current
last_updated: 2026-10-09
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

Deliverable 2 C20 adds `pnpm contracts:verify:identity --scope <backend-scope.json> --build <build-provenance.json>`. It performs only network/ledger reads and compares the explicit backend scope and selected local WASM bytes with deployed code and reciprocal contract links. `pnpm contracts:test:identity` runs 49 deterministic/local-transport tests. Build/test provenance is operator-supplied and must come from an actual matching source build; the verifier cannot independently certify it. Exit 0 means a point-in-time match; mismatch is 1, unknown/unavailable is 2. See [C20 inputs and evidence](../../instawards/Deliverable-2-C20-Deployment-Identity-Evidence.md). No production WASM or live identity verification was available on this host.

The older command below uses contract invocation and must not be treated as a read-only identity verifier.

`scripts/verify-testnet.sh` checks the authorized escrow contract in reputation, the linked reputation contract, platform admin, initial next escrow ID, and configured asset allowlists. It uses `deployments/testnet.json` as a fallback for public IDs and admin metadata.

## Web/backend release

The web package has `build`, `start`, and `dev` scripts. The backend package has Convex `dev` and dashboard scripts. Hosting/provider deployment configuration is not fully documented in this repository.

`deployments/testnet.json` and `deployments/mainnet.json` are public deployment records, not secrets. The smart-account deployment records are placeholders and do not establish passkey artifact deployment or audit status.

See [[contracts/Deployment Artifacts]], [[stellar/Network Configuration]], and [[stellar/Mainnet Readiness and Relayers]].

## Status

Status: Production hosting/release automation is not documented yet. The repository documents contract deployment scripts and readiness checks, but not a complete application CI/CD or rollback runbook.

## Multiple dispute admins

The current escrow deployment artifacts predate add_dispute_admin/remove_dispute_admin and participant-conflict enforcement. The new WASM requires a fresh contract deployment; do not treat a source build or the existing deployment JSON as proof that the feature is live.

Initial activation must use an isolated deployment and database. Configure the matching STELLAR_NETWORK and ESCROW_CONTRACT_ID scope on that backend and point the app at the same contract. Do not switch a populated environment: escrow IDs restart per contract, and current escrow lookup/synchronization is not safe when contract ID spaces overlap. This implementation did not deploy, submit Stellar transactions, alter live configuration, or migrate existing escrows.
