# C16 — Soroban dispute event handoff

## Status

This document freezes the Soroban event interface for successful dispute marking and resolution. C16 implements these events in the escrow source. This is a foundation for future event consumption; it does not add an indexer, backend ingestion, Convex schema changes, application audit events, frontend execution, or generated client changes.

Existing deployments do not gain this behavior until a new escrow contract deployment is made. Escrow IDs are scoped to the emitting contract and Stellar network.

## Event envelope

Both events are published by the escrow contract with the Soroban SDK `env.events().publish` API. The contract address is the event emitter. Transaction identity and ledger metadata come from the Soroban event envelope and are not duplicated in the payload.

Amounts are integer token base units (`i128`). Consumers must use the event's emitting contract and network when identifying an escrow by its `u64` ID.

## `dispute / marked`

Topics, in order:

```text
(Symbol("dispute"), Symbol("marked"), escrow_id: u64)
```

The named `#[contracttype]` payload is `DisputeMarkedEvent`:

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | `u32` | Payload version; currently `1`. |
| `actor` | `Address` | Authorized client, assigned freelancer, or platform admin that marked the escrow. |
| `status` | `TEscrowStatus` | Resulting stored status; `Disputed`. |

Exactly one event is emitted after the escrow write on a successful mark. Rejected calls emit no successful dispute event.

## `dispute / resolved`

Topics, in order:

```text
(Symbol("dispute"), Symbol("resolved"), escrow_id: u64)
```

The named `#[contracttype]` payload is `DisputeResolvedEvent`:

| Field | Type | Meaning |
| --- | --- | --- |
| `version` | `u32` | Payload version; currently `1`. |
| `actor` | `Address` | Owner or registered dispute admin that resolved the escrow. |
| `status` | `TEscrowStatus` | Resulting stored status: `Cancelled` for zero freelancer share, otherwise `Released`. |
| `resolution_hash` | `BytesN<32>` | Exact hash supplied to `resolve_dispute`; emitted only, not persisted in escrow storage. |
| `asset` | `Address` | Token contract address held by the escrow. |
| `client` | `Address` | Escrow client and refund recipient. |
| `freelancer` | `Address` | Assigned freelancer and payout recipient. |
| `freelancer_share_bps` | `u32` | Authorized freelancer share in basis points. |
| `freelancer_amount` | `i128` | Actual amount transferred to the freelancer after integer division. |
| `client_amount` | `i128` | Actual amount transferred to the client; includes any rounding remainder. |

Exactly one event is emitted after settlement transfers and the escrow write on a successful resolution. The amounts sum to the escrow amount. A zero amount has no corresponding token transfer, but remains present in the payload. Rejected or rolled-back settlement calls emit no successful resolution event.

## Compatibility notes

- Keep the `resolve_dispute` public argument name, type, and position as `_resolution_hash: BytesN<32>`; use its value in the event without adding storage.
- Preserve existing authorization, participant conflict checks, errors, TTL handling, settlement arithmetic, resulting status, and reputation behavior.
- Contract-side dispute events do not replace the Convex `disputeEvents` timeline and are not consumed by a chain indexer in C16.
- The reputation contract still emits no completion or dispute events.
