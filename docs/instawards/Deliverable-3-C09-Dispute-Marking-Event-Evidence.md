# Deliverable 3 C09 — Dispute-Marking Event Evidence

## Scope

C09 strengthens local Soroban regression coverage for the existing participant dispute-marking event. Contract implementation, event schema, public interface, and storage are unchanged.

## Requirement coverage

The existing `assert_mark_event` filtered events to the escrow contract's `dispute` topic before checking that one event existed. This could miss an unexpected extra event emitted under another topic. The assertion now checks the complete Soroban event list, requires marking to add exactly one event, and validates that event's emitter, ordered `(dispute, marked, escrow_id: u64)` topics, and exact versioned payload (`version: 1_u32`, authorized actor, and final `Disputed` status). Literal-map/XDR comparison, typed decoding, and comparison with persisted escrow status remain in place.

Existing role/state coverage is reused: client and assigned freelancer marking from `Funded` and `Submitted`, plus platform-owner compatibility coverage. The payload equality excludes any prior-state field.

## Validation

| Command | Result |
| --- | --- |
| `cargo test --locked -p highrable-escrow mark` | Passed: 13 tests. |
| `cargo test --workspace --locked` | Passed: 80 escrow tests and 9 reputation tests; no failures. |
| `cargo fmt --all -- --check` | Passed. |
| `pnpm contracts:build` | Passed. Reputation WASM: 5,359 bytes, SHA-256 `8c43d8f71f978ffda88ae30d930b55e4b8b4b07cecdf6caaf44b947d9252fd60`. Escrow WASM: 15,724 bytes, SHA-256 `d864cae616834033ff6015250f652681bc81dcfb2139687fef08ebd0935e95b7`. |
| `git diff --check` | Passed. |

These results are local Soroban test-host evidence with mocked authorization. They do not prove wallet signatures, deployed contract behavior, Testnet execution, or event indexing.
