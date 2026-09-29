---
type: contract
area: contracts
status: current
last_updated: 2026-09-29
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

The membership-enabled source is implemented and builds. Tracked testnet/mainnet deployment artifacts still refer to prior contract versions; this source has not been deployed and requires a fresh isolated deployment. Deployment metadata does not imply an audit or that every configured payment/smart-account path is operational.

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

No `events().publish(...)` or equivalent event emission is present in the current source.

## Tests

`contracts/escrow/src/test.rs` covers initialization/reinitialization, direct/open/create-and-fund flows, amount/freelancer validation, funding/assignment/submission/release, cancellation, dispute marking/resolution, allowlist behavior, token balances, reputation side effects, and distinct milestone/job hashes. Dispute marking and settlement tests prepare timestamped funded or submitted escrows through public contract calls. For settlement, invocation-scoped mock authorization covers the actor and all four `resolve_dispute` arguments; successful calls immediately assert the exact authorized invocation. Settlement coverage accepts `0`, `3_333`, and `10_000` basis points with payout and terminal-status assertions; rejects `10_001` and `u32::MAX`, authenticated outsiders, missing or wrong-actor authorization, `Created`/`Funded`/`Submitted`/`Released`/`Cancelled` statuses, and repeat settlement attempts. Rejected settlements compare the complete escrow record and client, freelancer, and contract token balances before and after. Registered-admin settlement and participant-conflict regressions remain covered. Dispute-marking tests also assert exact invocation authorization and preserved state for rejected calls. These mocks exercise Soroban host authorization enforcement, but do not prove cryptographic signatures or wallet integration behavior.

## Deployment Configuration

Deployment scripts build and initialize reputation before/around escrow wiring, verify getters, and optionally add configured stablecoin/native-XLM token contract IDs to the allowlist. See [[contracts/Deployment Artifacts]] and [[operations/Deployment]].

## Known Constraints

- `resolve_dispute` accepts `_resolution_hash` but does not store it.
- Contract membership and participant-conflict enforcement are available only after deploying the new WASM. Existing deployments keep their prior owner-only settlement logic.
- Zero share becomes `Cancelled`; positive share becomes `Released`, even if the client receives most/all of the refund.
- No escrow expiration/timeout is enforced on chain.
- No on-chain events or contract-side metadata beyond the structure above.
- `get_escrow` unwraps missing storage and may fail.

## Related Notes

[[contracts/Reputation Contract]], [[modules/Escrow and Payments]], [[modules/Disputes and Cancellations]], [[data/State Machines]]
