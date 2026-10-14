# Deliverable 3 C01 — Participant Marking Contract Handoff

## Scope

This handoff freezes the Soroban contract surface needed by participant case creation. It records the existing interface and behavior tests plus two new SDK-compatibility regressions. No production contract behavior or public interface changed.

## Public method and authorization

The participant marking entry point is:

```rust
mark_disputed(caller: Address, escrow_id: u64) -> Result<(), Error>
```

The client, assigned freelancer, and platform owner can mark an assigned escrow from `Funded` or `Submitted`. Registration as a dispute administrator grants settlement authority only; membership alone does not authorize participant marking.

| Contract boundary | Regression coverage |
| --- | --- |
| Exact method arguments and return type | `dispute_method_specs_are_frozen` |
| Client, assigned freelancer, and owner from both eligible states | `mark_disputed_accepts_each_authorized_role_from_funded_and_submitted` |
| Missing or mismatched actor authorization aborts at the host boundary | `mark_disputed_requires_host_authorization_for_each_role_and_valid_status` |
| Authenticated unrelated actor returns `Unauthorized` | `authenticated_outsider_cannot_mark_funded_or_submitted_escrows_disputed` |
| Registered dispute admin cannot mark by membership alone | `c06_registered_dispute_admin_cannot_mark_funded_or_submitted_escrows` |

## Errors and state guards

Host authorization aborts are distinct from returned contract errors. With authorization satisfied, marking returns:

| Condition | Result and coverage |
| --- | --- |
| Contract is not initialized | `NotInitialized`; `d3_c01_uninitialized_mark_returns_error_before_authorization` also asserts no auth request, event, or initialization change. |
| Escrow ID is missing | `EscrowNotFound`; `c07_missing_escrow_mark_preserves_records_balances_and_reputation`. |
| Open funded escrow has no assigned freelancer | `InvalidFreelancer`; `unassigned_funded_escrow_rejects_freelancer_required_actions`. |
| Authenticated actor is unrelated | `Unauthorized`; `authenticated_outsider_cannot_mark_funded_or_submitted_escrows_disputed`. |
| State is `Created`, `Released`, `Cancelled`, or already `Disputed` | `InvalidStatus`; `mark_disputed_rejects_every_permitted_role_for_invalid_statuses`. |
| Marking is repeated after a successful mark | `InvalidStatus`; `c20_disputed_escrows_cannot_be_disputed_again`. |

Rejected calls preserve escrow state and balances; relevant regressions also assert that marking emits no dispute event and performs no token transfer.

## Mark event

The escrow contract emits one event after a successful state write. Its ordered topics are `(Symbol("dispute"), Symbol("marked"), escrow_id: u64)`. The payload has exactly these fields: `version: u32` (`1`), `actor: Address` (the authorized caller), and `status: TEscrowStatus` (`Disputed`).

`d3_c01_mark_event_spec_is_frozen` decodes the generated SDK struct specification and independently locks its name and field names/types. The generated field list is alphabetical (`actor`, `status`, `version`). Existing `assert_mark_event` checks the emitter, full ordered topic vector, literal payload map, typed payload decoding, and agreement between emitted and persisted escrow IDs/status. Success and rejection coverage verifies event counts.

## Validation evidence and limits

Validation is local to the Soroban SDK and test host. It establishes generated-spec compatibility and mocked host authorization behavior; it does not prove cryptographic wallet signatures, deployed Testnet behavior, or a participant browser flow.

| Command | Result |
| --- | --- |
| `cargo test -p highrable-escrow d3_c01_` | Passed: 2 tests. |
| `cargo test -p highrable-escrow mark_disputed` | Passed: 3 marking role, authorization, and status tests. |
| `cargo test -p highrable-escrow dispute_method_specs_are_frozen` | Passed: 1 interface test. |
| `cargo test --workspace --locked` | Passed: 77 escrow tests and 9 reputation tests; no failures. This includes the status, error-code, event-payload, missing-ID, unassigned-escrow, outsider, registered-admin, and repeat-mark regressions. |
| `cargo fmt --all -- --check` | Passed. |
| `pnpm contracts:build` | Passed: reputation WASM 5,359 bytes, hash `8c43d8f71f978ffda88ae30d930b55e4b8b4b07cecdf6caaf44b947d9252fd60`; escrow WASM 15,724 bytes, hash `d864cae616834033ff6015250f652681bc81dcfb2139687fef08ebd0935e95b7`. |
| `git diff --check` | Passed. |
