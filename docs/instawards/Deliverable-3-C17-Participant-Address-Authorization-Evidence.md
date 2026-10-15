# Deliverable 3 C17 — Participant Address Authorization Evidence

## Scope and baseline gap

C17 adds contract-level marking authorization coverage for generic Soroban `Address` values. The pinned Soroban SDK 22 test utility `Address::generate` creates contract (`C…`) addresses, so the prior participant fixtures did not explicitly exercise account (`G…`) addresses. Existing invocation binding covered escrow-ID substitution for a funded client but did not cover the other authorization dimensions together.

No production contract code, public interface, storage, statuses, or dependencies changed.

## Coverage

The success matrix covers all four client/freelancer address-kind combinations (`G/G`, `G/C`, `C/G`, `C/C`), each role (client and freelancer), and both eligible starting states (`Funded` and `Submitted`): 16 successful marking calls. Tests verify the actual XDR address variants, the recorded `mark_disputed` authorization tree, exactly one attributed event, only the target status changing, and unchanged sibling escrow, balances, reputation, and next ID.

The rejection matrix uses a contract-address client and a valid funded target plus submitted sibling. Six cases cover absent auth, another actor's auth, a changed caller argument, a sibling escrow ID in the authorized arguments, a different method, and a different contract target. Each captures the authorization result immediately after the call and checks the shared full no-side-effects snapshot across both escrows, reputation, balances, ID allocation, and event counts.

The SDK's `MockAuth` registers its mock authorization contract at the authorized address, so it cannot be used with account addresses. Account-address success cases use the SDK's `mock_all_auths` host mode and assert the exact recorded invocation tree. Contract-address success cases and all authorization mismatch cases use invocation-scoped `MockAuth`. This is mocked host authorization evidence; it does not prove cryptographic account signatures, custom account authentication, WebAuthn, browser transaction construction, or deployed behavior.

## Validation

| Command | Result |
| --- | --- |
| `cargo test --locked -p highrable-escrow d3_c17` | Passed: 2 C17 tests, including 16 success combinations and 6 rejection cases. |
| `cargo test --locked -p highrable-escrow mark` | Passed: 16 marking-related tests. |
| `cargo test --locked -p highrable-escrow c20_` | Passed: 6 tests. |
| `cargo test --workspace --locked` | Passed: 83 escrow and 9 reputation tests; no failures. |
| `cargo fmt --all -- --check` | Passed. |
| `pnpm contracts:build` | Could not complete: pnpm attempted workspace dependency downloads and registry DNS lookups failed. |
| `stellar contract build` (from `contracts/`) | Passed: reputation WASM 5,359 bytes, SHA-256 `8c43d8f71f978ffda88ae30d930b55e4b8b4b07cecdf6caaf44b947d9252fd60`; escrow WASM 15,724 bytes, SHA-256 `d864cae616834033ff6015250f652681bc81dcfb2139687fef08ebd0935e95b7`. |
| `git diff --check` | Passed. |

These are local test-host and build results only. No deployment or live-chain verification was performed.
