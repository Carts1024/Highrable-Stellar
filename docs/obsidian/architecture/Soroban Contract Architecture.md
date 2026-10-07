---
type: architecture
area: contracts
status: current
last_updated: 2026-10-05
source_of_truth: repository
---

# Soroban Contract Architecture

The Rust workspace in `contracts/Cargo.toml` contains two packages using Soroban SDK `22.0.0`:

- `highrable-escrow`: custody and workflow state for token-backed freelance escrows.
- `highrable-reputation`: immutable completion records and freelancer aggregates.

```mermaid
flowchart LR
    C[Client/freelancer/admin auth] --> E[EscrowContract]
    E -->|token::Client transfer| A[Configured token/SAC]
    E -->|approve_and_release| R[ReputationContract]
    R --> S[Persistent completion + freelancer stats]
```

The escrow contract stores its configuration and counters in instance storage and each `TEscrow` in persistent storage. The reputation contract stores its authorized escrow address in instance storage and completion/stat records in persistent storage. Every public method calls `touch_instance`, extending instance TTL when below the threshold.

The escrow contract emits versioned `dispute/marked` and `dispute/resolved` events. The reputation contract emits no events, and no indexer consumes the escrow events. Off-chain mirror updates use explicit transaction results or action-driven RPC reads.

See [[contracts/Escrow Contract]], [[contracts/Reputation Contract]], and [[contracts/Deployment Artifacts]].
