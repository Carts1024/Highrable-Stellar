---
type: changelog
area: changelog
status: current
last_updated: 2026-09-28
source_of_truth: repository
---

# Knowledge Changelog

## 2026-09-28

- Added reusable timestamped escrow fixtures and stronger dispute lifecycle regression checks. Tests compare complete records and token balances around successful and rejected dispute marking; mocked authorization remains a lifecycle-testing boundary (see [[contracts/Escrow Contract]]).
- Added C04 dispute authorization coverage using exact invocation-scoped mock auth after broad fixture setup, including absent/mismatched host authorization and role/status boundaries. This verifies Soroban host authorization behavior, not cryptographic signatures or wallet integration (see [[contracts/Escrow Contract]]).

## 2026-09-27

- Updated the Velo Gas Station integration to SDK `0.1.0-alpha.4`, including the `tg_test_` Gas key requirement, corrected Testnet origin default, preferred `VELO_GAS_BASE_URL` configuration, and server-side key-shape validation.

## 2026-09-26

- Documented the opt-in Velo Gas Station Testnet boundary: pinned SDK, authenticated server handoff, Convex recovery identity, safe response fields, status-only recovery, and operator prerequisites.
- Documented landing-page responsive behavior: fluid root scale on large displays, `V2SnapGuard`-driven snap relaxation for oversized sections, and reduced reveal travel on phones (see [[frontend/Frontend Overview]]).

## 2026-09-21

- Initialized the repository-native Obsidian vault at `docs/obsidian/`.
- Added linked navigation, current-state classification, architecture, modules, data/state machines, contract notes, frontend/backend notes, Stellar/wallet notes, operations runbooks, workflows, and ADR index.
- Added root `AGENTS.md` with vault-reading and source-authority guidance.
- Added minimal `.obsidian/app.json` and narrowly scoped ignores for local workspace/cache state.
- Recorded known contradictions and gaps instead of presenting roadmap or phase prose as current behavior.

## Maintenance rule

Add an entry when documentation structure or a durable system-status classification changes. Feature-level implementation history belongs in version control and the relevant source/module note; this file should stay short.
