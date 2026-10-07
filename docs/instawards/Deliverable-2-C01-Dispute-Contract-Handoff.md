# C01 — Dispute Contract Compatibility Handoff

## Scope and numbering

C01 is the compatibility work item for freezing the current Soroban dispute interface. Its identifier is separate from the Instawards deliverable numbering; it does not rename or replace earlier Deliverable 2 documents. C01 adds Rust compatibility assertions and this handoff only. Contract behavior, storage, frontend APIs, and Convex schemas are unchanged.

The frozen event interface originated in C16. C01 adds independent test coverage for its wire representation; see [C16 — Soroban dispute event handoff](C16-Dispute-Event-Handoff.md) for the event design boundary.

## Frozen methods

The SDK-generated contract specifications expose these exact names, argument names, argument order, types, and return types:

```rust
mark_disputed(caller: Address, escrow_id: u64) -> Result<(), Error>

resolve_dispute(
    dispute_admin: Address,
    escrow_id: u64,
    freelancer_share_bps: u32,
    _resolution_hash: BytesN<32>,
) -> Result<(), Error>
```

The leading underscore in `_resolution_hash` is part of the public method specification. Its value is published under the event field name `resolution_hash`; the hash is not stored in the escrow record.

## Status and error vocabulary

All six escrow statuses keep their names and Soroban symbol-vector encoding:

| Status | Serialized enum value |
| --- | --- |
| `Created` | `[Symbol("Created")]` |
| `Funded` | `[Symbol("Funded")]` |
| `Submitted` | `[Symbol("Submitted")]` |
| `Released` | `[Symbol("Released")]` |
| `Cancelled` | `[Symbol("Cancelled")]` |
| `Disputed` | `[Symbol("Disputed")]` |

The contract error names and numeric codes are frozen:

| Error | Code |
| --- | ---: |
| `AlreadyInitialized` | 1 |
| `NotInitialized` | 2 |
| `Unauthorized` | 3 |
| `InvalidAmount` | 4 |
| `EscrowNotFound` | 5 |
| `InvalidStatus` | 6 |
| `InvalidRating` | 7 |
| `InvalidFreelancer` | 8 |
| `AssetNotAllowed` | 9 |
| `InvalidShareBps` | 10 |

Host authorization failures remain distinct from these returned contract errors. The tests assert missing or mismatched authorization as a Soroban host `InvokeError::Abort`; an authenticated actor rejected by contract policy returns `Error::Unauthorized` (code 3).

## C16 event interface

Both event types are emitted by the escrow contract. Topic order is fixed, with the escrow ID encoded as `u64`:

| Event | Ordered topics |
| --- | --- |
| Mark | `Symbol("dispute"), Symbol("marked"), escrow_id: u64` |
| Resolve | `Symbol("dispute"), Symbol("resolved"), escrow_id: u64` |

The named payloads use these exact fields and types. The version is `1` for both events. Status values use the same one-symbol vector encoding listed above.

| Mark payload field | Type |
| --- | --- |
| `version` | `u32` |
| `actor` | `Address` |
| `status` | `TEscrowStatus` |

| Resolve payload field | Type |
| --- | --- |
| `version` | `u32` |
| `actor` | `Address` |
| `status` | `TEscrowStatus` |
| `resolution_hash` | `BytesN<32>` |
| `asset` | `Address` |
| `client` | `Address` |
| `freelancer` | `Address` |
| `freelancer_share_bps` | `u32` |
| `freelancer_amount` | `i128` |
| `client_amount` | `i128` |

The C01 event assertions build expected named maps from literal field names and explicitly typed values, then compare the complete serialized maps while retaining typed decoding checks. They also lock the emitter and ordered topics. Amounts are raw token base units; the client amount includes integer-division remainder. Existing settlement coverage now locks these event values for amount `301`:

| Freelancer share | Freelancer amount | Client amount | On-chain status |
| ---: | ---: | ---: | --- |
| 0 bps | 0 | 301 | `Cancelled` |
| 3,333 bps | 100 | 201 | `Released` |
| 10,000 bps | 301 | 0 | `Released` |

Successful marking and resolution emit one corresponding dispute event. Existing rejection and transfer-failure tests continue to assert that rejected or rolled-back operations emit no successful dispute event.

## Backend mapping and ingestion boundary

The successful-mark callback and its local projections map as follows:

| Chain event/state or application callback | Local Convex projection |
| --- | --- |
| Soroban escrow state `Disputed` / `dispute/marked` event | Escrow mirror status `disputed`; successful application callback sets dispute `onChainStatus: "marked"` and writes timeline event `on_chain_mark_succeeded`. The dispute review status is unchanged. |
| Zero-share settlement: Soroban `Cancelled` | Dispute status `resolved_client` |
| Full-share settlement: Soroban `Released` | Dispute status `resolved_freelancer` |
| Intermediate-share settlement: Soroban `Released` | Dispute status `split_resolution` |

The event's `actor` is the authorized contract caller address. It does not contain the Convex dispute ID, callback wallet type, or application actor role; the application supplies that context. The transaction hash comes from Stellar transaction execution. `marking` and `mark_failed` are Convex marking phases, not Soroban escrow states or contract events.

Soroban contract events are separate from Convex `disputeEvents` timeline records. No contract-event indexer or ingestion path exists, so the event does not automatically create or update Convex records. The browser flow records the successful callback after transaction confirmation; Rust tests assert contract output, while existing Convex tests independently cover callback bookkeeping.

For C07 Rust regression coverage and validation evidence, see [C07 Dispute Marking Evidence](C07-Dispute-Marking-Evidence.md).

## Validation evidence and limits

Local validation completed on 2026-10-05:

| Command | Result |
| --- | --- |
| Baseline `cargo test -p highrable-escrow` before edits | Passed: 61 escrow tests, 0 failed. |
| `cargo test -p highrable-escrow c01_` | Passed: 3 compatibility tests, 0 failed. |
| `cargo test -p highrable-escrow dispute` | Passed: 21 matching dispute tests, 0 failed. |
| `cargo test -p highrable-escrow failed_second_settlement_transfer_rolls_back_and_emits_no_resolution_event` | Passed: 1 rollback/event test, 0 failed. |
| `cargo test` from `contracts` | Passed: 64 escrow tests and 9 reputation tests, 0 failed. |
| `pnpm contracts:build` | Passed: reputation WASM 5,359 bytes, hash `8c43d8f71f978ffda88ae30d930b55e4b8b4b07cecdf6caaf44b947d9252fd60`; escrow WASM 15,912 bytes, hash `a3d5ebcb3d0f04503796a0a94a4e80f094a5e3f2022f89f4ab2485c59760f597`. |
| `cargo fmt --all -- --check` and `git diff --check` | Passed after formatting. |

These checks establish compatibility assertions against the locally compiled SDK specs, local Soroban host behavior, and successful WASM compilation. They do not establish the behavior of a deployed contract or provide Testnet verification. The tracked deployments remain on earlier contract versions; no deployment, live transaction, Convex event ingestion, or wallet-signature verification was performed for C01.
