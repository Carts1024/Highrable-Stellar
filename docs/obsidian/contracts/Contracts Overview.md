---
type: contract
area: contracts
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Contracts Overview

## Purpose

Highrable’s Soroban contracts keep the fund-moving and portable reputation rules on chain while Convex holds the broader marketplace workflow.

## Workspace

- Workspace: `contracts/Cargo.toml`
- Packages: `highrable-escrow`, `highrable-reputation`
- SDK: `soroban-sdk = 22.0.0`
- Tests: `contracts/escrow/src/test.rs`, `contracts/reputation/src/test.rs`

## Wiring

Deployment initializes escrow with the reputation contract and platform admin, then initializes reputation with the escrow contract as its authorized writer. The escrow release method invokes reputation `record_completion`.

## What contracts own

- Token-backed escrow custody and state transitions.
- Authorization of client, freelancer, and platform-admin actions.
- Immutable completion record and aggregate freelancer stats.
- Instance TTL extension on public calls.

## What contracts do not own

- Job descriptions, applications, agreements, chat, attachments, deadlines, admin notes, or dispute evidence.
- Historical transaction indexing or event-driven Convex synchronization.
- A decentralized arbitration mechanism.
- Contract events in the current source.

See [[contracts/Escrow Contract]], [[contracts/Reputation Contract]], and [[architecture/Soroban Contract Architecture]].
