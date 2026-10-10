# Deliverable 2 C18 — Settlement Invariant Evidence

Verified locally on 2026-10-07. C18 replaces the overflow-prone settlement multiplication with an equivalent quotient/remainder calculation and adds three focused Soroban regression tests. The public contract interface, storage, settlement statuses, and event shape are unchanged.

## Acceptance coverage

| Test | Coverage | Evidence |
| --- | --- | --- |
| `c18_settlement_basis_point_matrix_conserves_every_escrow` | 5 amounts (`1`, `101`, `301`, `10_000`, `10_001`) × 6 shares (`0`, `1`, `3_333`, `5_000`, `9_999`, `10_000`) × `Funded`/`Submitted` origins × owner/registered-admin actors. | 120 settlements verify exact client/freelancer gains, floor rounding with the remainder assigned to the client, nonnegative payouts, complete escrow record and timestamp, and matching resolution event. Contract balance decreases by exactly the settled escrow amount. |
| `c18_settlement_handles_i128_boundary_amounts_without_overflow` | Amounts at `i128::MAX / 10_000`, one unit above it, and `i128::MAX`, with shares from 1 through 10,000 bps. | Seven settlements verify exact event and balance amounts, terminal state, full record, and conservation using isolated token supplies. This includes funded/submitted origins and both owner/admin actors. |
| `c18_settlement_preserves_shared_and_other_asset_escrow_funds` | Refund, 3,333-bps split, and full payout while another disputed escrow shares the same token and a funded escrow uses a second token. | Each target settlement reduces only its own token balance; the same-token sibling remains funded in the contract and is subsequently settled successfully. The other asset balance and record remain unchanged. |

The test oracle uses checked `u128` multiplication where the product fits and fixed independently calculated payouts for the `i128::MAX` cases whose products exceed `u128`. The contract retains its prior floor division and client-remainder semantics. Zero share remains `Cancelled`; any positive share remains `Released`, including payouts rounded down to zero.

## Validation

- Before the contract arithmetic fix, the `i128::MAX` regression failed with a Soroban invocation abort (`Err(Err(Abort))`) during settlement.
- `cargo test --locked -p highrable-escrow c18_` — 3 tests passed.
- `cargo test --workspace --locked` — 75 escrow and 9 reputation tests passed; doc tests passed.
- `cargo fmt --all -- --check` — passed.
- `pnpm contracts:build` — both reputation and escrow WASM contracts built successfully.

## Limits

These are local Soroban tests using mocked authorization and fixture tokens. They do not prove wallet signatures or deployed behavior. No deployment or network transaction was performed.
