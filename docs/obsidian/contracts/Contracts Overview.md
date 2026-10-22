---
type: contract
area: contracts
status: current
last_updated: 2026-10-15
source_of_truth: repository
---

# Contracts Overview

## Purpose

Highrable’s Soroban contracts keep fund-moving and portable reputation rules on chain while Convex holds the broader marketplace workflow. A separate user registry stores wallet-authorized self-registration facts; it does not store profiles or approve identities.

## Workspace

- Workspace: `contracts/Cargo.toml`
- Packages: `highrable-escrow`, `highrable-reputation`, `highrable-registry`
- SDK: `soroban-sdk = 22.0.0`
- Tests: `contracts/escrow/src/test.rs`, `contracts/reputation/src/test.rs`, `contracts/registry/src/test.rs`

## Wiring

Deployment initializes escrow with the reputation contract and platform admin, then initializes reputation with the escrow contract as its authorized writer. The escrow release method invokes reputation `record_completion`.

## What contracts own

- Token-backed escrow custody and state transitions.
- Authorization of client, freelancer, and platform-admin actions.
- Immutable completion record and aggregate freelancer stats.
- Wallet address and timestamp for public, self-authorized registration.
- Instance TTL extension on public calls.

## What contracts do not own

- Job descriptions, applications, agreements, chat, attachments, deadlines, admin notes, or dispute evidence.
- Historical transaction indexing or event-driven Convex synchronization.
- A decentralized arbitration mechanism.
- General event-driven Convex synchronization. Escrow and registry emit versioned events, but no event indexer consumes them.

The registry is prepared but has not been deployed; see [[contracts/User Registry Contract]] and [[operations/Deployment]].

See [[contracts/Escrow Contract]], [[contracts/Reputation Contract]], [[contracts/User Registry Contract]], and [[architecture/Soroban Contract Architecture]].
