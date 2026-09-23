---
type: changelog
area: changelog
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Knowledge Changelog

## 2026-09-23

- Documented the escrow dispute test foundation: public-call funded/submitted fixtures and full-record/token-balance preservation checks for successful marking, invalid statuses, and unauthorized callers.

## 2026-09-21

- Initialized the repository-native Obsidian vault at `docs/obsidian/`.
- Added linked navigation, current-state classification, architecture, modules, data/state machines, contract notes, frontend/backend notes, Stellar/wallet notes, operations runbooks, workflows, and ADR index.
- Added root `AGENTS.md` with vault-reading and source-authority guidance.
- Added minimal `.obsidian/app.json` and narrowly scoped ignores for local workspace/cache state.
- Recorded known contradictions and gaps instead of presenting roadmap or phase prose as current behavior.

## Maintenance rule

Add an entry when documentation structure or a durable system-status classification changes. Feature-level implementation history belongs in version control and the relevant source/module note; this file should stay short.
