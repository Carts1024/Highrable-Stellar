# Deliverable 2 C06 — Dispute Authorization and Resolution Guard Evidence

## Scope

C06 adds local regression coverage to `contracts/escrow/src/test.rs`. No public interface, storage, production contract logic, frontend, backend, or deployment behavior changed. The tests use Soroban invocation-scoped mocked authorization, which exercises host authorization checks but does not prove wallet signatures or deployed behavior.

## Requirement-to-test mapping

| C06 requirement | Test coverage | Evidence asserted |
| --- | --- | --- |
| Revoked administrator | `c06_revoked_dispute_admin_loses_settlement_authority_until_reregistered` | A registered admin is removed after a dispute is opened. Settlement with correct invocation auth returns `Unauthorized`; the complete escrow record, client/freelancer/contract balances, and dispute/transfer event counts are preserved. Re-registering the same actor permits settlement. Success checks exact invocation auth, full record change including timestamp, resolution event payload, transfer events, and conserved payouts. |
| Participant conflicts | `dispute_admin_actor_cannot_settle_as_an_escrow_participant` | Retains owner-as-client and registered-admin-as-freelancer cases, and adds owner-as-freelancer and registered-admin-as-client. Each attempt has correct host authorization, returns `Unauthorized`, and preserves the escrow record, relevant participant/contract balances, and dispute/transfer event counts. |
| Registered-admin marking boundary | `c06_registered_dispute_admin_cannot_mark_funded_or_submitted_escrows` | A registered nonparticipant admin has exact host auth for `mark_disputed` against both `Funded` and `Submitted` escrows; each returns `Unauthorized` and preserves the complete record, balances, and dispute/transfer event counts. |
| Settlement share boundaries | `c06_dispute_settlement_boundary_shares_are_released_for_both_admin_roles_and_origins` | Eight successful cases cover owner and registered-admin actors, `Funded` and `Submitted` dispute origins, and `1` and `9_999` bps. For amount `301`, payouts are `0/301` and `300/1` (freelancer/client). Both results are `Released`, including the rounded-zero freelancer payout. Each checks exact invocation auth, complete record and `released_at`, event payload, transfer events, and balance conservation. |
| Invalid shares for both admin roles | `resolve_dispute_rejects_invalid_basis_points_without_settlement` | Owner and registered admin each attempt `10_001` and `u32::MAX`; calls return `InvalidShareBps` and preserve the complete record, balances, and dispute/transfer event counts. |
| Every non-disputed status for both admin roles | `resolve_dispute_rejects_non_disputed_statuses_and_repeat_settlement` | Owner and registered admin each attempt settlement from `Created`, `Funded`, `Submitted`, `Released`, and `Cancelled`; each returns `InvalidStatus` and preserves the complete record, balances, and dispute/transfer event counts. Repeat settlement after both terminal outcomes remains rejected for both actors. |

Existing tests continue to cover zero share, full payout, rounded split, ordinary registered-admin settlement, unknown-admin denial, missing/mismatched host auth, and event rollback on a failed second transfer. These combine with the C06 cases for the broader dispute guard matrix.

## Validation

Commands were run from `contracts/`:

| Command | Result |
| --- | --- |
| `cargo test --locked -p highrable-escrow dispute` | Passed: 24 tests, 0 failed. |
| `cargo test --workspace --locked` | Passed: 67 escrow tests and 9 reputation tests; doc tests passed with 0 tests. |
| `cargo fmt --all -- --check` | Passed. |

This is local Soroban test evidence only. Current source deployment and existing deployment-version limitations are unchanged; see [Escrow Contract](../obsidian/contracts/Escrow%20Contract.md) and [Current System State](../obsidian/Current%20System%20State.md).
