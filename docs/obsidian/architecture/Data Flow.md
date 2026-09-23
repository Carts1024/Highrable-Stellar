---
type: architecture
area: data-flow
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Data Flow

## Typical escrow flow

```mermaid
sequenceDiagram
    participant UI as Feature hook
    participant C as Convex
    participant W as Wallet or passkey
    participant RPC as Stellar RPC
    participant E as Escrow contract
    participant R as Reputation contract

    UI->>C: create/prepare local job and workflow records
    UI->>RPC: simulate and prepare contract call
    RPC-->>W: prepared transaction / authorization context
    W-->>RPC: signed external or WebAuthn-mediated transaction
    RPC->>E: submit state-changing call
    E-->>RPC: confirmed result
    UI->>C: store tx hash and update mirror/status
    E->>R: record_completion on ordinary release
    UI->>C: optional sync action reads E/R and applies safe mirror update
```

The exact order varies by action. For example, `createEscrowRecord` accepts an on-chain escrow ID after the browser call, while `updateEscrowStatus` stores operation-specific transaction hashes and patches job/milestone state. Chain execution and Convex bookkeeping are separate operations; a successful chain transaction does not make a failed Convex mutation disappear.

## Read flow

- Browser contract reads use `simulateContractCall` with a classic source account where RPC requires one.
- Backend sync actions use `packages/backend/convex/lib/stellarReads.ts`, which builds a simulation transaction from `STELLAR_READ_SOURCE_ACCOUNT`.
- The backend normalizes Soroban enum/address/bytes values and then calls internal mutations.

## Dispute flow

Convex stores evidence, participant responses, timeline events, and admin review state. The browser can call `mark_disputed`; the contract moves `Funded` or `Submitted` to `Disputed`. Admin settlement calls `resolve_dispute` on chain, then Convex records the settlement result and patches escrow/job/milestone terminal state.

## What is not automated

There is no all-wallet historical transaction scan, no event-driven indexer, and no cron that continuously reconciles every escrow/reputation record. The only current cron is deadline reminder scanning.

See [[modules/Sync and Transactions]], [[backend/Sync and Scheduled Jobs]], and [[Current System State]].
