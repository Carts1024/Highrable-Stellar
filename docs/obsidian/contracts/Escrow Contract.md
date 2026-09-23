---
type: contract
area: contracts
status: current
last_updated: 2026-09-21
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

Implemented and deployed artifacts are recorded for testnet/mainnet escrow contracts. Deployment metadata does not imply an audit or that every configured payment/smart-account path is operational.

## Public Interface

| Method | Behavior |
| --- | --- |
| `initialize(reputation_contract_address, platform_admin)` | One-time setup; requires platform-admin auth; stores config and starts next ID at `1`. |
| `create_escrow(client, freelancer, asset, amount, job_hash)` | Creates `Created` escrow with assigned freelancer; client auth; rejects same client/freelancer. |
| `create_open_escrow(client, asset, amount, job_hash)` | Creates `Created` escrow with no freelancer; client auth. |
| `create_and_fund_open_escrow(client, asset, amount, job_hash)` | Creates `Funded` open escrow and transfers asset from client to contract atomically. |
| `add_allowed_asset(platform_admin, asset)` / `remove_allowed_asset(...)` | Admin-managed instance allowlist and count. |
| `is_allowed_asset(asset)` / `get_allowed_asset_count()` | Allowlist reads. |
| `fund_escrow(client, escrow_id)` | `Created → Funded`; client auth and client-to-contract token transfer. |
| `assign_freelancer(client, escrow_id, freelancer)` | Assigns once while `Created` or `Funded`; client auth. |
| `submit_work(freelancer, escrow_id, proof_hash)` | `Funded → Submitted`; assigned freelancer auth; stores proof hash. |
| `approve_and_release(client, escrow_id, rating, review_hash)` | `Submitted → Released`; client auth; pays freelancer and calls reputation. |
| `cancel_escrow(client, escrow_id)` | `Created → Cancelled` or `Funded → Cancelled` with funded refund; client auth. |
| `mark_disputed(caller, escrow_id)` | `Funded/Submitted → Disputed`; client, assigned freelancer, or platform admin auth. |
| `resolve_dispute(platform_admin, escrow_id, freelancer_share_bps, resolution_hash)` | Admin-only settlement of `Disputed`; splits/refunds funds and sets `Cancelled` for zero share or `Released` for positive share. |
| `get_escrow(escrow_id)` | Read `TEscrow`; unwraps missing record and therefore can fail rather than return `Result`. |
| `get_next_escrow_id()` | Read next ID. |
| `get_reputation_contract()` / `get_platform_admin()` | Read stored configuration. |
| `is_initialized()` | Read initialization flag. |

## Storage

Instance keys: `Initialized`, `ReputationContract`, `PlatformAdmin`, `NextEscrowId`, `AllowedAsset(Address)`, `AllowedAssetCount`.

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
- Admin methods: supplied platform admin must require auth and equal stored admin.
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

`contracts/escrow/src/test.rs` covers initialization/reinitialization, direct/open/create-and-fund flows, amount/freelancer validation, funding/assignment/submission/release, cancellation, dispute marking/resolution, allowlist behavior, token balances, reputation side effects, and distinct milestone/job hashes.

## Deployment Configuration

Deployment scripts build and initialize reputation before/around escrow wiring, verify getters, and optionally add configured stablecoin/native-XLM token contract IDs to the allowlist. See [[contracts/Deployment Artifacts]] and [[operations/Deployment]].

## Known Constraints

- `resolve_dispute` accepts `_resolution_hash` but does not store it.
- Zero share becomes `Cancelled`; positive share becomes `Released`, even if the client receives most/all of the refund.
- No escrow expiration/timeout is enforced on chain.
- No on-chain events or contract-side metadata beyond the structure above.
- `get_escrow` unwraps missing storage and may fail.

## Related Notes

[[contracts/Reputation Contract]], [[modules/Escrow and Payments]], [[modules/Disputes and Cancellations]], [[data/State Machines]]
