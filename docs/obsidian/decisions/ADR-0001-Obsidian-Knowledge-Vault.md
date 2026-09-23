---
type: adr
area: decisions
status: accepted
last_updated: 2026-09-21
source_of_truth: repository
---

# ADR-0001: Repository-Native Obsidian Knowledge Vault

## Context

Highrable spans Next.js, Convex, Stellar/Soroban contracts, wallets, passkeys, deployment scripts, and operational configuration. Existing documentation is useful but distributed across root guides, phase notes, deployment notes, and implementation inventories. Future agents need a compact navigation and context layer without treating stale prose as the implementation authority.

## Decision

Maintain an Obsidian-compatible vault under `docs/obsidian/` with:

- a linked home/navigation layer;
- repository map, current-state classification, development guidance, and glossary;
- architecture, module, data, contract, frontend, backend, Stellar, and operations notes;
- workflows, a small ADR index, and a knowledge changelog;
- only minimal `.obsidian` configuration and narrowly scoped ignored workspace/cache files.

Add root `AGENTS.md` instructing coding agents to read the vault before broad exploration, follow source authority, preserve changes, and keep secrets out of documentation.

## Consequences

- New agents get a stable starting point and explicit links between product, backend, chain, and operations concerns.
- Notes may become stale; source/tests/config remain authoritative and every note carries a status/date.
- The vault adds maintenance work when routes, statuses, env variables, contracts, or deployment assumptions change.
- Obsidian workspace state is ignored narrowly; substantive Markdown remains commit-friendly.

## Revisit when

- the repository adopts a different knowledge system;
- docs are generated from source and this hand-maintained layer becomes redundant;
- a production documentation owner defines stricter publication/security requirements.

See [[Home]], [[Repository Map]], and [[workflows/Agent Workflow]].
