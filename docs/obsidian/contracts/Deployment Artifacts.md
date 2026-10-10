---
type: contract
area: deployment
status: current
last_updated: 2026-10-02
source_of_truth: repository
---

# Deployment Artifacts

## Tracked artifacts

- `deployments/testnet.json`: recorded Stellar Testnet network/RPC/Horizon values, escrow/reputation IDs, platform admin, deployer metadata, and deployment timestamp.
- deployments/testnet-multi-admin.json: a separate Testnet record added on 2026-09-29 with a different escrow/reputation pair and deployment timestamp for the multi-admin work.
- `deployments/mainnet.json`: recorded Stellar Mainnet network/RPC/Horizon values, escrow/reputation IDs, platform admin, deployer metadata, and deployment timestamp.
- `deployments/smart-accounts/testnet.json`: smart-account metadata placeholder with empty WASM/verifier/factory/relayer/verification fields.
- `deployments/smart-accounts/mainnet.json`: smart-account metadata placeholder with empty WASM/verifier/factory/relayer/verification fields and an explicit warning that configuration readiness is not an audit.

The escrow/reputation JSON files contain public contract/account metadata; the smart-account files do not prove that smart-account artifacts are deployed or verified. Never add private deployment identities, secret keys, or credentials to these notes.

## Deployment workflow

`scripts/deploy-contracts.sh`:

1. Validates network, endpoints, deployer identity, platform-admin public key, and account existence.
2. Builds both Rust contracts.
3. Estimates upload/invocation fees.
4. Uploads/deploys reputation and escrow WASM.
5. Initializes/wires the contracts in the expected order.
6. Verifies contract wiring and optionally allowlists configured token contracts.
7. Writes the selected JSON artifact and prints environment variable names/values for operators.

`deploy-testnet.sh` supplies testnet defaults. `deploy-mainnet.sh` requires `MAINNET_DEPLOY_CONFIRM=deploy-highrable-mainnet`, HTTPS non-testnet endpoints, and mainnet-specific environment. `verify-testnet.sh` checks contract links, platform admin, next escrow ID, and configured allowlist values.

## Smart-account metadata

The web readiness code expects public metadata such as account WASM hash, verifier contract ID/hash, factory ID, deployment label/version/source repository, app domain/RP ID, payment assets, and relayer kind. The tracked smart-account artifacts currently leave those values empty. Fill them only from verified deployment evidence.

## Production distinction

Recorded contract IDs, configured environment, readiness checks, and a successful deployment are separate claims. None alone proves audited production infrastructure, funded relayer operation, or safe mainnet passkey escrow.

## Dispute-admin contract version

The canonical deployments/testnet.json and deployments/mainnet.json files still contain the earlier deployments. The separate testnet-multi-admin.json records a Testnet contract ID and a deployedAt timestamp of 2026-09-29T01:41:27Z (09:41 +08). That timestamp precedes commit c6cc7e1 at 10:03 +08, which adds dispute-admin membership to source. The file has no WASM hash, deployment transaction link, or verification output, so it does not establish that the membership-enabled build was deployed.

Soroban dispute events were added on September 30, after the separate artifact timestamp. The artifact therefore does not establish that the event-enabled source is deployed. Verify the deployed contract identity and behavior before activating the matching Convex network/contract scope; use an isolated deployment/database for the event-enabled version. The C20 evidence note reports no deployment during that regression/build run. Existing deployment records still do not verify the membership/event-enabled source.
## Related Notes

[[operations/Deployment]], [[stellar/Mainnet Readiness and Relayers]], [[contracts/Contracts Overview]]
