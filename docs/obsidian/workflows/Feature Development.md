---
type: workflow
area: workflow
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Feature Development

1. Read [[Home]], [[Repository Map]], [[Current System State]], and the relevant module/architecture notes.
2. Locate the source slice: route/component, Convex schema/functions, Stellar wrapper, or contract method.
3. Confirm the existing state machine and authorization boundary before adding a status or action.
4. Implement the smallest scoped change. Keep chain calls, Convex bookkeeping, and UI state transitions explicit.
5. Add/update tests at the affected layer. For chain changes, preserve Rust tests and testnet verification assumptions.
6. Run focused checks, then the broader build/lint/test checks that are practical.
7. Update affected vault notes when behavior, status, path, environment variable, or known limitation changes.
8. Review the diff for secrets, stale links, and claims that are stronger than the source supports.

## Change-specific notes

- New route: update [[frontend/Routes and API]] and the feature-slice map.
- New Convex table/function/status: update [[data/Convex Schema]], [[data/State Machines]], and [[backend/Domain Functions]].
- New contract method/status: update [[contracts/Contracts Overview]], the contract note, and deployment/readiness notes.
- New environment variable: update the source schema and [[operations/Environment Variables]].
- New wallet/relayer behavior: update [[stellar/Wallet Identity Model]], [[stellar/Transaction Lifecycle]], and readiness notes.

## Finish condition

Do not mark a feature “implemented” merely because a component exists. Verify the actual integration, authorization, persistence, chain behavior, and tests; otherwise classify it as incomplete, experimental, placeholder, or planned in [[Current System State]].
