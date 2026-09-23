---
type: reference
area: stellar
status: incomplete
last_updated: 2026-09-21
source_of_truth: repository
---

# Mainnet Readiness and Relayers

`apps/web/core/stellar/mainnet-readiness.ts` and `relayer-readiness.ts` provide preflight checks. They inspect network/RPC/Horizon consistency, HTTPS app domain and RP ID, contract IDs, account WASM/verifier metadata, target contract restrictions, fee source, asset configuration, and relayer kind.

## Relayer kinds

The current type surface recognizes:

- `none`
- `custom`
- `openzeppelin_channels`
- `sdk_source_account`
- `unknown`

Launchtube is not a supported current path. A configured URL or a passing client preflight does not establish availability, funding, rate limits, monitoring, abuse controls, or recovery procedures.

## Current readiness blockers/risks

- Smart-account deployment JSONs contain placeholder/empty metadata.
- Backend signed-session enforcement still has explicit TODOs.
- Convex sync is action-driven, without a production event/indexer layer.
- Current contracts do not publish explicit events.
- Proof privacy/content hashing remains incomplete.
- There is no documented production-hardened relayer audit or operational runbook.
- Existing readiness docs explicitly say readiness is not an audit.

## Safe interpretation

Treat readiness output as a configuration and compatibility diagnostic. Before a real mainnet launch, separately verify contract source/build/deployment, administrator custody, asset allowlists, smart-account artifacts, relayer authorization and funding, monitoring/alerts, rate limits, incident response, backups, and signed-auth coverage.

See [[operations/Deployment]], [[contracts/Deployment Artifacts]], [[stellar/Smart Accounts and Passkeys]], and [[Current System State]].
