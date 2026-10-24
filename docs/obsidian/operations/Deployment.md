---
type: runbook
area: operations
status: current
last_updated: 2026-10-15
source_of_truth: repository
---

# Deployment

## Contract deployment

The root scripts expose:

- `pnpm contracts:build` → `cd contracts && stellar contract build`.
- `pnpm contracts:deploy:testnet` → testnet wrapper around `scripts/deploy-contracts.sh`.
- `pnpm contracts:deploy:mainnet` → guarded mainnet wrapper.
- `pnpm contracts:verify:testnet` → `scripts/verify-testnet.sh`.
- `bash scripts/deploy-registry.sh` → builds/deploys only `highrable-registry`, writing `deployments/registry-<network>.json` separately from escrow/reputation artifacts.
- `bash scripts/verify-registry.sh <G...>` → read-only `get_registration` and `is_registered` calls for one wallet.

`deploy-contracts.sh` validates the network/endpoints/deployer identity/public platform admin, builds both contracts, estimates fees, uploads/deploys WASM, initializes and wires reputation/escrow, optionally allowlists configured token contracts, verifies wiring, and writes a deployment artifact.

The registry scripts are isolated from that workflow: they do not read, deploy, initialize, or overwrite escrow/reputation contracts or their tracked identities. The registry deployment script requires an explicit `DEPLOYER`, `NETWORK`, and `STELLAR_RPC_URL`; it refuses to overwrite an existing registry artifact and derives a deterministic ID for recovery. Do not execute it until an operator has authorized a deployment. Verify a deployment with `verify-registry.sh` and a known wallet; `get_registration` and `is_registered` should agree, showing a matching record/timestamp for a registered wallet or `null`/`false` for an unused one.

Activation remains separate: set `NEXT_PUBLIC_REGISTRY_CONTRACT_ID` and Convex `REGISTRY_CONTRACT_ID` to the same verified ID, with matching `STELLAR_NETWORK`, RPC, and passphrase, then release the signup gate. No registry contract is currently deployed or configured by this implementation.

## Mainnet guardrails

`scripts/deploy-mainnet.sh` requires `MAINNET_DEPLOY_CONFIRM=deploy-highrable-mainnet`, HTTPS RPC/Horizon endpoints, and non-testnet-looking URLs before delegating to the shared script. Deployment identities are Stellar CLI identity names; the script rejects a raw secret key in `DEPLOYER`.

Do not run a deployment command as a documentation validation step. It changes external network state and requires an explicit operator decision and verified credentials.

## Testnet verification

Deliverable 2 C20 adds `pnpm contracts:verify:identity --scope <backend-scope.json> --build <build-provenance.json>`. It performs only network/ledger reads and compares the explicit backend scope and selected local WASM bytes with deployed code and reciprocal contract links. Deliverable 3 C21 adds child-process acceptance coverage for the actual CLI, relative artifact paths, JSON output, sanitization, repeatability, and exit codes. `pnpm contracts:test:identity` runs 57 tests, including a loopback RPC fixture that accepts only network and ledger reads. Build/test provenance is operator-supplied and must come from an actual matching source build; the verifier cannot independently certify it. Exit 0 means a point-in-time match; mismatch is 1, unknown/unavailable is 2. See [C20 inputs and evidence](../../instawards/Deliverable-2-C20-Deployment-Identity-Evidence.md) and [C21 local CLI evidence](../../instawards/Deliverable-3-C21-Deployment-Identity-CLI-Evidence.md). Synthetic fixture results do not establish production WASM provenance or live identity; no production WASM or live identity verification was available on this host.

The older command below uses contract invocation and must not be treated as a read-only identity verifier.

`scripts/verify-testnet.sh` checks the authorized escrow contract in reputation, the linked reputation contract, platform admin, initial next escrow ID, and configured asset allowlists. It uses `deployments/testnet.json` as a fallback for public IDs and admin metadata.

## Web/backend release

The web package has `build`, `start`, and `dev` scripts. The backend package has Convex `dev` and dashboard scripts. `.github/workflows/deploy.yml` adds a manual production release for the existing Vercel web project and existing Convex Testnet deployment; Soroban contracts are built and tested by CI but are never deployed by this workflow.

### One-time provider and repository setup

1. Create a GitHub repository environment named `production`. Add `VERCEL_TOKEN` and a production-only `CONVEX_DEPLOY_KEY` under environment secrets. Add `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `EXPECTED_CONVEX_URL` as environment variables. The expected URL must be the Convex deployment selected by the production deploy key.
2. Configure the Vercel project Root Directory as `apps/web` and keep the pnpm workspace root/lockfile available so imports from `packages/ui`, `packages/backend`, and `packages/convex-client` resolve. The workflow invokes Vercel CLI from the monorepo root with `--cwd apps/web`.
3. Disable independent automatic Git deployments for this Vercel project. The release workflow is the only production publisher; preview deployments can remain separately configured.
4. Configure branch protection for `main` to require the stable status check `CI / required`.
5. Ensure the Vercel production environment selects `NEXT_PUBLIC_STELLAR_NETWORK=testnet` and points `NEXT_PUBLIC_CONVEX_URL` to the expected Convex deployment. Verify the existing deployment key is for that same deployment.

### Manual release and recovery

Run **Actions → Production Release → Run workflow** and select `main`. The workflow captures the dispatch commit SHA, validates that the ref is `main`, reruns CI for that immutable commit, then enters the GitHub `production` environment. Vercel pulls production settings; the guard checks Testnet and the Convex target before any deployment. The installed backend Convex CLI deploys with `--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL` and runs `vercel build --prod --yes --cwd apps/web` from the repository root. Only after the command succeeds does the workflow publish `apps/web/.vercel/output` with `vercel deploy --prebuilt --prod`. The Vercel CLI is pinned to `63.1.2`.

The run summary records source SHA, CI/guard/deploy outcomes, and the deployment URL when available. Pulled `.vercel/.env.production.local` is removed after the release attempt. It and the Vercel build output are never uploaded as GitHub artifacts.

A Convex deploy can succeed before Vercel publication fails. In that case the run summary identifies the partial result and the new backend may already be active. Keep backend releases backward-compatible with the currently published frontend. Rerun the release against the same commit after resolving the Vercel failure or publish that commit through the approved Vercel process. Do not automatically roll back Convex data or schema. The workflow does not deploy Soroban contracts, migrate data, or change the Testnet network scope.

`deployments/testnet.json` and `deployments/mainnet.json` are public deployment records, not secrets. The smart-account deployment records are placeholders and do not establish passkey artifact deployment or audit status.

See [[contracts/Deployment Artifacts]], [[stellar/Network Configuration]], and [[stellar/Mainnet Readiness and Relayers]].

## Status

Status: CI and manual application release automation are implemented. GitHub environment configuration, Vercel project settings, branch protection, and the first hosted release remain operator activation steps. No hosted run or first live release is claimed by local validation.

## Multiple dispute admins

The current escrow deployment artifacts predate add_dispute_admin/remove_dispute_admin and participant-conflict enforcement. The new WASM requires a fresh contract deployment; do not treat a source build or the existing deployment JSON as proof that the feature is live.

Initial activation must use an isolated deployment and database. Configure the matching STELLAR_NETWORK and ESCROW_CONTRACT_ID scope on that backend and point the app at the same contract. Do not switch a populated environment: escrow IDs restart per contract, and current escrow lookup/synchronization is not safe when contract ID spaces overlap. This implementation did not deploy, submit Stellar transactions, alter live configuration, or migrate existing escrows.
