---
type: runbook
area: operations
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Testing

## Test layers

| Layer | Command/location | Scope |
| --- | --- | --- |
| Web unit/component tests | `pnpm --filter web test` | Vitest suite under `apps/web`. |
| Type/lint/build checks | `pnpm build`, `pnpm lint:fix` | Next build, TypeScript, oxlint/oxfmt through package scripts. |
| Soroban contract tests | `cd contracts && cargo test` | Escrow/reputation behavior using Soroban test utilities. |
| Deployment verification | `pnpm contracts:verify:testnet` | Live testnet wiring/admin/allowlist checks; requires Stellar CLI identity and network access. |

## Contract coverage to preserve

The Rust tests cover initialization/reinitialization, authorization, amount/rating validation, duplicate reputation completion, aggregate statistics, escrow lifecycle/status guards, dispute flows, asset allowlisting, and contract wiring assumptions. Read the tests before changing a contract error or status.

## Web/chain boundary cases

When changing wallet or contract code, test at least:

- external wallet signing and user rejection;
- passkey smart-account preflight and authorization-entry signing;
- simulation failure versus submission failure versus confirmation timeout;
- correct client/freelancer/admin actor for each escrow action;
- integer amount/decimal conversion and unsupported assets;
- network/passphrase/RPC/Horizon mismatch handling;
- Convex phase persistence when chain submission succeeds, fails, or times out.

## What is not automatically proven

Passing local tests does not prove deployed contract IDs are wired correctly, a relayer is funded/available, production auth TODOs are resolved, or attachment/proof privacy is complete. Use [[operations/Deployment]] and [[stellar/Mainnet Readiness and Relayers]] for those checks.
