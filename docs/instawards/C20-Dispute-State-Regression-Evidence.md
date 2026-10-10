# C20 — Dispute State Regression Evidence

Verified locally on 2026-10-01. C20 adds six Rust regression tests in [the escrow test module](../../contracts/escrow/src/test.rs), preserving production contract code and the existing 55 escrow tests.

## Coverage matrix

| Test | Fixtures | Rejected calls |
| --- | --- | --- |
| `c20_disputed_escrows_cannot_be_submitted` | Disputed from Funded and Submitted | Assigned freelancer submission: 2 calls |
| `c20_disputed_escrows_cannot_be_released` | Disputed from Funded and Submitted | Client approval/release with valid rating: 2 calls |
| `c20_disputed_escrows_cannot_be_cancelled` | Disputed from Funded and Submitted | Client cancellation: 2 calls |
| `c20_disputed_escrows_cannot_be_disputed_again` | Disputed from Funded and Submitted | Client, freelancer, and platform-owner marking: 6 calls |
| `c20_settlement_terminal_outcomes_cannot_be_reentered` | Each dispute origin settled at 0, 3,333, or 10,000 bps: 6 fixtures | Eight calls per fixture: 48 calls |
| `c20_ordinary_terminal_outcomes_cannot_be_reentered` | Ordinary release; cancellation from Created and Funded: 3 fixtures | Eight calls per fixture: 24 calls |

The terminal matrix rejects funding, submission, approval/release, cancellation, marking by each of the three permitted roles, and settlement at valid 5,000 bps. Zero-share settlement is Cancelled; positive-share settlements are Released. Total: **84 rejected invocations**.

Fixtures reach their states through public methods. Each rejected invocation uses the appropriate actor and exact invocation-scoped mock authorization, advances ledger time, and supplies a hash distinct from the stored proof/review or original settlement hash. It must return `Err(Ok(Error::InvalidStatus))`, preserve the complete escrow record, client/freelancer/contract token balances, completion record and freelancer statistics, and add no dispute or token-transfer events. Ordinary release starts with an existing completion; cancellation and dispute settlement start without one. Existing authorization, successful settlement, rounding, conservation, and rollback tests remain intact.

## Validation

| Command | Working directory | Result |
| --- | --- | --- |
| `cargo test --offline -p highrable-escrow` (before changes) | `contracts` | Exit 0; 55 passed |
| `cargo test --offline -p highrable-escrow c20_` | `contracts` | Exit 0; 6 passed, 55 filtered out |
| `cargo test` | `contracts` | Exit 0; 61 escrow + 9 reputation tests passed; zero failures; both doc-test targets passed with zero tests |
| `pnpm contracts:build` | Repository root | Interrupted (exit 130) after pnpm attempted dependency downloads and encountered registry DNS failures; the contract script did not run |
| `stellar contract build` | `contracts` | Exit 0; both WASM contracts built successfully using the underlying command defined by `contracts:build` |
| `rustfmt --edition 2021 --check contracts/escrow/src/test.rs` | Repository root | Exit 0 |
| `git diff --check` | Repository root | Exit 0 |

The successful build produced optimized escrow WASM of 15,912 bytes and reputation WASM of 5,359 bytes. No deployment was performed.

## Boundaries and remaining evidence

No public interface, storage, authorization, payment arithmetic, SDK, environment, or deployment configuration changed. Existing modified Convex generated files were outside this task and were preserved.

Native Soroban tests exercise host authorization with mocks and local token/reputation collaborators. They do not prove cryptographic signatures, wallet/passkey integration, deployed contract behavior, live Testnet lifecycles, or production readiness. Current membership-enabled/event-emitting source remains undeployed. C20 does not complete the wider Sprint 4 or Week 1 acceptance gates, and no commit, branch, or PR attribution evidence was created.
