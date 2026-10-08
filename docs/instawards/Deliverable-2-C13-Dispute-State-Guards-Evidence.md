# Deliverable 2 C13 — Dispute State Guard Evidence

Verified locally on 2026-10-07. C13 adds three focused Soroban regression tests in [the escrow test module](../../contracts/escrow/src/test.rs). Contract source and public behavior are unchanged.

## Coverage matrix

| Test | Coverage | Expected result |
| --- | --- | --- |
| `c13_mark_authorization_is_bound_to_the_escrow_id` | Two eligible funded escrows; mock authorization is for the first ID, while the second ID is attempted. | Soroban host authorization abort; both full records, token balances, reputation records/statistics, and event counts remain unchanged. |
| `c13_resolve_authorization_is_bound_to_signer_and_all_arguments` | Missing authorization, a different signer, and authorized calls whose escrow ID, basis-point share, or resolution hash differs from the attempted call. | Each invocation aborts at the host authorization boundary without state, transfer, reputation, or dispute-event changes. |
| `c13_settlement_emits_one_terminal_outcome_and_rejects_all_retries` | Funded and submitted dispute origins; platform owner and registered admin; `0`, `3_333`, and `10_000` bps. | Each successful settlement emits one matching resolution event, persists `Cancelled` for zero share or `Released` for positive share, and leaves an unrelated funded escrow unchanged. Identical, changed-share, changed-hash, and repeat-mark attempts return `InvalidStatus` without further writes, transfers, or dispute events. |

The lifecycle matrix has 12 successful settlements. Rejected retries advance ledger time and compare the full terminal escrow record, participant/contract balances, completion record, freelancer statistics, and unrelated escrow record. Ordinary dispute settlement does not create a reputation completion. Existing C06 and C20 coverage continues to cover membership/participant conflicts and the wider invalid-state transition matrix.

The Soroban test environment exposes events for the current invocation. Tests decode and validate the emitted event before reading persisted state, then compare the captured event status to the stored terminal status.

## Validation

- Baseline before edits: `cargo test --workspace --locked` — 69 escrow and 9 reputation tests passed.
- Focused: `cargo test -p highrable-escrow --locked c13_` — 3 tests passed.
- Full workspace: `cargo test --workspace --locked` — 72 escrow and 9 reputation tests passed; doc tests passed.
- Build: `pnpm contracts:build` — reputation and escrow WASM contracts built successfully.
- Formatting: `cargo fmt --all -- --check` — passed.

## Limits

Mock authorization verifies Soroban host authorization behavior; it does not prove wallet signatures, passkey integration, or deployed contract behavior. No network transaction, deployment, indexer, or Convex event ingestion was exercised. The membership-enabled and event-emitting contract source remains subject to the deployment limitations recorded in the [Escrow Contract note](../obsidian/contracts/Escrow%20Contract.md).
