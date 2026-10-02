---
type: contract
area: contracts
status: current
last_updated: 2026-10-01
source_of_truth: repository
---

# Escrow Contract

## Purpose

Hold an allowlisted token amount for a client/freelancer work escrow, enforce lifecycle authorization, and record completion through the reputation contract on ordinary release.

## Location

- Source: `contracts/escrow/src/lib.rs`
- Tests: `contracts/escrow/src/test.rs`
- Package: `contracts/escrow/Cargo.toml`

## Current Status

The membership-enabled source and C16 versioned dispute events are implemented and build. Tracked testnet/mainnet deployment artifacts still refer to prior contract versions; this source has not been deployed and requires a fresh isolated deployment. Existing deployments do not emit the C16 events. Deployment metadata does not imply an audit or that every configured payment/smart-account path is operational.

## Public Interface

| Method | Behavior |
| --- | --- |
| `initialize(reputation_contract_address, platform_admin)` | One-time setup; requires platform-admin auth; stores config and starts next ID at `1`. |
| `create_escrow(client, freelancer, asset, amount, job_hash)` | Creates `Created` escrow with assigned freelancer; client auth; rejects same client/freelancer. |
| `create_open_escrow(client, asset, amount, job_hash)` | Creates `Created` escrow with no freelancer; client auth. |
| `create_and_fund_open_escrow(client, asset, amount, job_hash)` | Creates `Funded` open escrow and transfers asset from client to contract atomically. |
| `add_allowed_asset(platform_admin, asset)` / `remove_allowed_asset(...)` | Admin-managed instance allowlist and count. |
| `add_dispute_admin(platform_admin, dispute_admin)` / `remove_dispute_admin(...)` | Owner-authenticated, idempotent dispute-admin membership management; the owner is implicit and cannot be removed. |
| `is_dispute_admin(dispute_admin)` | Returns true for the owner or an explicitly registered dispute admin. |
| `is_allowed_asset(asset)` / `get_allowed_asset_count()` | Allowlist reads. |
| `fund_escrow(client, escrow_id)` | `Created → Funded`; client auth and client-to-contract token transfer. |
| `assign_freelancer(client, escrow_id, freelancer)` | Assigns once while `Created` or `Funded`; client auth. |
| `submit_work(freelancer, escrow_id, proof_hash)` | `Funded → Submitted`; assigned freelancer auth; stores proof hash. |
| `approve_and_release(client, escrow_id, rating, review_hash)` | `Submitted → Released`; client auth; pays freelancer and calls reputation. |
| `cancel_escrow(client, escrow_id)` | `Created → Cancelled` or `Funded → Cancelled` with funded refund; client auth. |
| `mark_disputed(caller, escrow_id)` | `Funded/Submitted → Disputed`; client, assigned freelancer, or platform admin auth. |
| `resolve_dispute(dispute_admin, escrow_id, freelancer_share_bps, resolution_hash)` | Requires the actor's auth and owner/registered membership; rejects client/freelancer actors; settles `Disputed` with existing split/refund behavior. |
| `get_escrow(escrow_id)` | Read `TEscrow`; unwraps missing record and therefore can fail rather than return `Result`. |
| `get_next_escrow_id()` | Read next ID. |
| `get_reputation_contract()` / `get_platform_admin()` | Read stored configuration. |
| `is_initialized()` | Read initialization flag. |

## Storage

Instance keys: `Initialized`, `ReputationContract`, `PlatformAdmin`, `NextEscrowId`, `AllowedAsset(Address)`, `AllowedAssetCount`, and appended `DisputeAdmin(Address)`. The existing key variants and escrow record shape remain unchanged.

Persistent key: `Escrow(u64)` containing `TEscrow`:

```text
escrow_id, client, freelancer?, asset, amount, job_hash,
proof_hash?, status, created_at, funded_at, submitted_at, released_at
```

The source explicitly extends instance TTL from threshold `100` to `518400` on each public call. It does not contain separate explicit persistent-entry TTL extension logic.

## Status Transitions

```text
Created ──fund──> Funded ──submit──> Submitted ──approve_and_release──> Released
   │                 │                   │
   └─cancel──────────┴─cancel────────────┘ (Submitted cancellation is rejected)
                     │
                     └─mark_disputed──> Disputed ──resolve──> Cancelled or Released
```

Assignment is allowed once from `Created`/`Funded` when no freelancer exists. Dispute marking is allowed only from `Funded`/`Submitted`.

## Authorization

- `initialize`: `platform_admin.require_auth()`; the supplied address becomes the stored admin.
- Client methods: client address must require auth and match stored client where applicable.
- `submit_work`: freelancer address must require auth and match assigned freelancer.
- `mark_disputed`: caller must require auth and match client, assigned freelancer, or stored admin.
- Owner methods: supplied platform admin must require auth and equal stored admin.
- Dispute-admin membership methods and `resolve_dispute` extend dispute-only authority. The owner is implicitly a member; settlement rejects either escrow participant as actor. Asset allowlisting and all unrelated owner-only operations remain owner-only.
- Read methods require initialization except `is_initialized` and can still extend instance TTL.

## Token Transfers

The contract uses `token::Client` for the address passed as `asset`:

- Funding: client → escrow contract.
- Ordinary release: escrow contract → assigned freelancer for full amount.
- Funded cancel: escrow contract → client for full amount.
- Dispute settlement: escrow contract → freelancer/client using basis-point split; client receives the remainder.

Amounts must be positive `i128`; the contract does not attach token decimals to an escrow.

## Cross-Contract Calls

`approve_and_release` invokes the configured reputation contract’s `record_completion` with escrow ID, client, freelancer, asset, amount, job hash, rating, and review hash. `resolve_dispute` does not invoke reputation.

## Events

The source publishes one versioned named payload after each successful dispute state write:

| Operation | Topics | Payload |
| --- | --- | --- |
| Mark | `(dispute, marked, escrow_id: u64)` | `DisputeMarkedEvent { version: u32, actor: Address, status: TEscrowStatus }`; version is `1`, status is `Disputed`. |
| Resolve | `(dispute, resolved, escrow_id: u64)` | `DisputeResolvedEvent` with version, actor, resulting status, supplied 32-byte resolution hash, asset, client, freelancer, share basis points, and actual freelancer/client amounts. |

Resolution amounts are raw token base units (`i128`); the client amount includes the rounding remainder. The resolution hash is emitted but is not stored in `TEscrow`. Contract address, transaction identity, and ledger metadata come from the event envelope. Escrow IDs are scoped to the emitting contract and network. The full frozen interface and backend boundary are in [C16-Dispute-Event-Handoff](../../instawards/C16-Dispute-Event-Handoff.md). No indexer consumes these events yet.

## Tests

`contracts/escrow/src/test.rs` covers initialization/reinitialization, direct/open/create-and-fund flows, amount/freelancer validation, funding/assignment/submission/release, cancellation, dispute marking/resolution, allowlist behavior, token balances, reputation side effects, and distinct milestone/job hashes. Dispute marking and settlement tests prepare timestamped funded or submitted escrows through public contract calls. For settlement, invocation-scoped mock authorization covers the actor and all four `resolve_dispute` arguments; successful calls immediately assert the exact authorized invocation. Settlement coverage accepts `0`, `3_333`, and `10_000` basis points with payout and terminal-status assertions; full refund, full payout, and rounded split outcomes each run from isolated `Funded` and `Submitted` dispute fixtures. They compare the complete escrow record, verify the settlement timestamp for positive shares, and assert expected participant gains and contract balance conservation from the pre-settlement balances. Settlement rejects `10_001` and `u32::MAX`, authenticated outsiders, missing or wrong-actor authorization, `Created`/`Funded`/`Submitted`/`Released`/`Cancelled` statuses, and repeat settlement attempts. Rejected settlements compare the complete escrow record and client, freelancer, and contract token balances before and after. Registered-admin settlement and participant-conflict regressions remain covered. Dispute event assertions verify emitter, exact topics, typed named payload fields and values, one event on success, and no new dispute event on rejection; token-transfer events are checked under the token emitter. A failing second settlement transfer verifies rollback and no resolution event. These mocks exercise Soroban host authorization enforcement, but do not prove cryptographic signatures or wallet integration behavior.

## C20 terminal-state regression coverage

Six focused Rust tests cover disputed escrows originating in both `Funded` and `Submitted`, rejecting submission, ordinary release, cancellation, and repeat marking by client, freelancer, and platform owner. Terminal matrices cover refund, split, and full-payout settlements from both origins, ordinary release, and cancellation from `Created` and `Funded`. Across 84 rejected invocations, exact invocation-scoped mock authorization and valid arguments isolate `InvalidStatus`; full escrow records, participant/contract balances, completion records, freelancer statistics, and dispute/transfer event counts are preserved. Timestamps advance and replacement hashes differ from fixture hashes. Existing positive, authorization, rounding, and rollback coverage remains intact. The full workspace passes 61 escrow and 9 reputation tests; both WASM contracts build locally. See [C20 evidence](../../instawards/C20-Dispute-State-Regression-Evidence.md) for the matrix, commands, and pnpm wrapper limitation. This does not verify deployed behavior.

## Deployment Configuration

Deployment scripts build and initialize reputation before/around escrow wiring, verify getters, and optionally add configured stablecoin/native-XLM token contract IDs to the allowlist. See [[contracts/Deployment Artifacts]] and [[operations/Deployment]].

## Known Constraints

- `resolve_dispute` accepts `_resolution_hash` and emits it in `DisputeResolvedEvent`, but does not persist it in escrow storage.
- Contract membership and participant-conflict enforcement are available only after deploying the new WASM. Existing deployments keep their prior owner-only settlement logic.
- Existing deployments also lack C16 dispute event emission until replaced with a WASM that contains the event interface; the reputation contract still emits no events.
- Zero share becomes `Cancelled`; positive share becomes `Released`, even if the client receives most/all of the refund.
- No escrow expiration/timeout is enforced on chain.
- No contract-event indexer or backend ingestion is implemented.
- `get_escrow` unwraps missing storage and may fail.

## Related Notes

[[contracts/Reputation Contract]], [[modules/Escrow and Payments]], [[modules/Disputes and Cancellations]], [[data/State Machines]]
