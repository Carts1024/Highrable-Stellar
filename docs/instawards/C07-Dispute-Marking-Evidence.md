# C07 — Soroban Dispute Marking Evidence

## Scope

C07 adds regression coverage for the existing `mark_disputed` state transition and versioned `dispute/marked` event. It does not change contract behavior, public methods, storage, authorization, or deployments.

## Verified behavior

- The event's ordered topics identify the escrow ID; its payload carries version `1`, the authorized caller address, and resulting status `Disputed`.
- Tests independently decode the event and compare its escrow ID and status with the persisted escrow record.
- `c07_mark_events_identify_the_changed_escrow_and_preserve_unrelated_state` marks separate `Funded` and `Submitted` escrows as different authorized actors. It verifies each event, complete target-record transition, unchanged unrelated record, balances, completion records, and freelancer statistics.
- `c07_missing_escrow_mark_preserves_records_balances_and_reputation` uses exact invocation-scoped authorization for the next unused ID. It expects `EscrowNotFound` and verifies no dispute or transfer event, no writes to the existing escrow, unchanged balances and reputation, and an unchanged next ID.
- Existing tests continue to cover unauthorized and missing authorization, unassigned freelancer rejection, invalid source statuses, and repeated marking.

## Callback mapping and limits

Soroban `Disputed` maps to escrow mirror status `disputed`. The confirmed application callback records dispute `onChainStatus: "marked"` and timeline type `on_chain_mark_succeeded`; dispute review status is unchanged. The event actor is the contract caller address. Callback wallet type, Convex dispute ID, and actor role come from application context; transaction hash comes from transaction execution. `marking` and `mark_failed` are Convex phases, not contract statuses or events.

Contract events are not automatically ingested into Convex. These Rust tests establish local Soroban host and contract behavior only. Existing Convex callback tests independently cover bookkeeping; neither test layer verifies deployed contract behavior, live RPC confirmation, or cryptographic wallet signatures. See the [C01 handoff](Deliverable-2-C01-Dispute-Contract-Handoff.md) for the interface boundary.

## Validation

| Command | Result |
| --- | --- |
| `cargo test -p highrable-escrow c07_` | Passed: 2 C07 tests. |
| `cargo test -p highrable-escrow dispute` | Passed: 24 matching dispute tests. |
| `cargo test --workspace --locked` | Passed: 69 escrow tests and 9 reputation tests. |
| `cargo fmt --all -- --check` | Passed. |
| `git diff --check` | Passed. |

The test suite is local; no Testnet transaction or deployment verification is performed for C07.
