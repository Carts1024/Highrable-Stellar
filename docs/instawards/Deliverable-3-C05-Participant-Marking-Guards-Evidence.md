# Deliverable 3 C05 — Participant Marking Guard Evidence

## Scope

C05 adds Soroban regression coverage for participant authorization and state guards in `mark_disputed`. Production contract code, its public interface, and storage are unchanged.

## Requirement coverage

| Requirement | Coverage |
| --- | --- |
| Client and assigned freelancer mark only `Funded` or `Submitted` escrows | Existing `mark_disputed_accepts_each_authorized_role_from_funded_and_submitted`; new `d3_c05_assignment_enables_client_and_freelancer_marking_from_funded_and_submitted` prepares open work through public funding/assignment/submission calls. |
| Unassigned, Created, and funded open escrows reject marking | `d3_c05_unassigned_open_escrows_reject_marking_in_created_and_funded_states` covers `Created`, separately funded, and atomically funded open escrows. The client, prospective freelancer, and owner receive `InvalidFreelancer`. |
| Assignment enables participant marking and repeated marking is rejected | `d3_c05_assignment_enables_client_and_freelancer_marking_from_funded_and_submitted` checks pre-assignment rejection, then client/freelancer success from both eligible states, status-only mutation, unchanged balances, and `InvalidStatus` on repeat. |
| Participants cannot act on another escrow | `d3_c05_participants_from_other_escrows_cannot_mark_funded_or_submitted_work` uses two client/freelancer pairs and both eligible states. Each foreign participant receives `Unauthorized`; all four escrow records, participant balances, contract balance, and dispute/transfer event counts remain unchanged. |
| Missing authorization, unrelated actors, invalid states, and terminal outcomes remain guarded | Existing `mark_disputed_requires_host_authorization_for_each_role_and_valid_status`, `authenticated_outsider_cannot_mark_funded_or_submitted_escrows_disputed`, `mark_disputed_rejects_every_permitted_role_for_invalid_statuses`, and C20 terminal-action regressions. |

For calls expected to return contract errors, tests assert `Err(Ok(Error::...))`. A host authorization abort is `Err(Err(InvokeError::Abort))`; the two outcomes remain distinct. Successful calls continue to assert the exact invocation authorization.

## Validation

| Command | Result |
| --- | --- |
| `cargo test --locked -p highrable-escrow d3_c05_` | Passed: 3 tests. |
| `cargo test --workspace --locked` | Passed: 80 escrow tests and 9 reputation tests; no failures. |
| `cargo fmt --all -- --check` | Passed. |
| `pnpm contracts:build` | Passed. Reputation WASM: 5,359 bytes, SHA-256 `8c43d8f71f978ffda88ae30d930b55e4b8b4b07cecdf6caaf44b947d9252fd60`. Escrow WASM: 15,724 bytes, SHA-256 `d864cae616834033ff6015250f652681bc81dcfb2139687fef08ebd0935e95b7`. |
| `git diff --check` | Passed. |

These are local Soroban test-host results with mocked authorization. They do not prove wallet signatures, browser-to-contract execution, or deployed Testnet behavior.
