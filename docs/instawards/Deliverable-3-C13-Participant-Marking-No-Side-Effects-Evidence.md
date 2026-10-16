# Deliverable 3 C13 — Participant Marking No-Side-Effects Evidence

## Scope

C13 strengthens local Soroban regressions for repeated or invalid participant dispute marking. Escrow contract logic, public interface, storage, and status vocabulary are unchanged.

## Requirement coverage

The shared rejection snapshot in `contracts/escrow/src/test.rs` captures all target escrow records through `try_get_escrow`, reputation completion records and freelancer statistics, client/freelancer/contract token balances, next escrow ID, and total, dispute, and asset-transfer event counts. After a rejected invocation, event counts are compared before any follow-up contract reads.

Existing marking tests use the snapshot for invocation-scoped authorization failures, authenticated outsiders, unassigned work, missing escrow IDs, invalid statuses, and repeated marking. The C20 terminal matrix also checks rejected re-entry after disputes originating in both `Funded` and `Submitted`, refund/split/full-payout settlement outcomes, ordinary release, and cancellation from `Created`/`Funded`.

The dedicated `d3_c13_rejected_marking_preserves_existing_reputation_and_other_work` test completes one escrow through ordinary release to create a real reputation completion and nonzero freelancer statistics. It then rejects client and freelancer marking attempts against separate assigned work in `Created`, checking that both escrow records, the completion, aggregate statistics, balances, ID allocation, and all contract events remain unchanged.

## Validation

| Command | Result |
| --- | --- |
| `cargo test --locked -p highrable-escrow mark` | Passed: 14 tests. |
| `cargo test --locked -p highrable-escrow c20_` | Passed: 6 tests. |
| `cargo test --locked -p highrable-escrow d3_c13` | Passed: 1 test. |
| `cargo test --workspace --locked` | Passed: 81 escrow tests and 9 reputation tests; no failures. |
| `cargo fmt --all -- --check` | Passed. |
| `pnpm contracts:build` | Passed. Reputation WASM: 5,359 bytes, SHA-256 `8c43d8f71f978ffda88ae30d930b55e4b8b4b07cecdf6caaf44b947d9252fd60`. Escrow WASM: 15,724 bytes, SHA-256 `d864cae616834033ff6015250f652681bc81dcfb2139687fef08ebd0935e95b7`. |
| Diff whitespace check | Passed for the tracked patch and new evidence note; no whitespace errors. |

These results are local Soroban test-host evidence with mocked authorization. They do not prove wallet signatures, deployed contract behavior, or Testnet execution.
