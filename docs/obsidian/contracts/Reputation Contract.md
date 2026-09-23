---
type: contract
area: contracts
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Reputation Contract

## Purpose

Store one immutable completion record per escrow and aggregate completed count, total earned, and rating totals for each freelancer.

## Location

- Source: `contracts/reputation/src/lib.rs`
- Tests: `contracts/reputation/src/test.rs`
- Package: `contracts/reputation/Cargo.toml`

## Current Status

Implemented and wired as the escrow release target. It is an on-chain reputation primitive, not a complete profile/search/indexing system.

## Public Interface

| Method | Behavior |
| --- | --- |
| `initialize(authorized_escrow_contract)` | One-time storage of the only authorized completion writer. The current source does not call `require_auth()` during initialization. |
| `record_completion(escrow_id, client, freelancer, asset, amount, job_hash, rating, review_hash)` | Authorized escrow-only write; stores immutable completion and updates freelancer aggregates. |
| `get_completion(escrow_id)` | Returns optional immutable completion record. |
| `has_completion(escrow_id)` | Completion existence check. |
| `get_freelancer_stats(freelancer)` | Returns aggregate stats with integer `average_rating`. |
| `get_authorized_escrow_contract()` | Returns configured writer, if initialized. |
| `is_initialized()` | Checks whether an authorized escrow is stored. |

## Storage

Instance key: `AuthorizedEscrowContract`.

Persistent keys: `Completion(u64)` containing `TCompletionRecord` and `FreelancerStats(Address)` containing internal aggregate totals.

Completion fields are escrow ID, client, freelancer, asset, amount, job hash, rating, review hash, and ledger completion timestamp. View stats add `average_rating` to count/earned/total-rating.

Instance TTL is extended from threshold `100` to `518400` on every public call. No separate explicit persistent TTL extension logic is present.

## Status / Write Rules

There is no status machine. A completion ID can be written once; a duplicate returns `CompletionAlreadyRecorded`. Amount must be positive and rating must be `1..=5`. Stats use checked arithmetic and return `ArithmeticOverflow` on overflow.

## Authorization

`record_completion` loads the configured authorized escrow address and calls `authorized_escrow_contract.require_auth()`. It does not compare the `client` or `freelancer` arguments against any other stored record; the escrow contract is trusted to supply the completion context.

Initialization itself stores the supplied authorized address without an explicit auth requirement in current Rust source. Treat initialization as a deployment-time trust boundary.

## Token Transfers

None. The reputation contract never moves assets; escrow does that before invoking completion recording.

## Cross-Contract Calls

Called by `EscrowContract.approve_and_release`. It does not call another contract.

## Events

No contract event emission is present.

## Tests

`contracts/reputation/src/test.rs` covers initialization/reinitialization, authorized versus unauthorized recording, duplicate IDs, rating/amount validation, aggregate stats, and per-freelancer isolation.

## Deployment Configuration

The deploy flow initializes this contract with the deployed escrow contract address and verifies `get_authorized_escrow_contract`. See [[contracts/Deployment Artifacts]].

## Known Constraints

- Initialization auth is not enforced in the current source.
- Aggregate average rating uses integer division.
- Completion records store hashes and addresses, not human-readable review text.
- No events or historical indexing integration exist.

## Related Notes

[[contracts/Escrow Contract]], [[modules/Profiles and Reputation]], [[modules/Sync and Transactions]]
