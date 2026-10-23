---
type: evidence
area: admin
status: current
last_updated: 2026-10-23
source_of_truth: repository
---

# Administrator External Resolution Recovery Evidence

## Finding

The reported preflight was protecting funds correctly: settlement start requires Soroban escrow state `Disputed`, while the user saw Stellar report `Released`. The supplied Testnet transactions establish that escrow 24 on configured contract `CBM4HLBLGPW3WJXNZXWUJ6PBXMQPYXM6RUXPFYBSNLVT3JAGIQMT73NM` had already gone through a successful dispute mark and resolution:

| Transaction | Verified chain operation | Result |
| --- | --- | --- |
| [b14d0fa6996902aaae08c72d59c9878b55644bdee66b1495e78ca8252de5effb](https://stellar.expert/explorer/testnet/tx/b14d0fa6996902aaae08c72d59c9878b55644bdee66b1495e78ca8252de5effb) | `mark_disputed`, escrow 24 | Successful |
| [77f29c005aef1dc0f6ee90b3fcbeffbfb7973b956742b8fe153c54aa924f9952](https://stellar.expert/explorer/testnet/tx/77f29c005aef1dc0f6ee90b3fcbeffbfb7973b956742b8fe153c54aa924f9952) | `resolve_dispute`, escrow 24, 10,000 bps to freelancer | Successful; 100 XLM transferred |

The later `Released` state is therefore consistent with the confirmed resolution. Horizon reports the resolution transaction as successful at ledger 5,347,251, with source account `GA2YV6BC3AM3JQ3FBJOM6JWFWUNFS2AEHD5RLGMLXH3OEYOGLTRVSPD6`; a read-only account-history query found it in the latest 200 transaction records. The chain evidence does not establish why the corresponding product bookkeeping was absent or whether the successful transaction was submitted by this application. No saved attempt was available to use for ordinary signed-transaction recovery.

## Fix

- When settlement preflight finds a terminal chain state, the resolve API automatically searches the assigned admin wallet's Horizon account history for the exact configured contract, `resolve_dispute` method, actor, and escrow ID. It starts after the saved dispute-mark transaction when that hash is available and otherwise scans the latest bounded history window.
- The server independently verifies RPC success, transaction hash/envelope, configured network and contract scope, exact `resolve_dispute` call, assigned admin argument, escrow ID, share bounds, and transaction expiry. It then verifies current escrow participants and that the current terminal status matches the transaction's share.
- Convex creates or attaches a signed settlement attempt and invokes the existing success mutation for normal transaction, escrow, dispute, event, and notification bookkeeping. The recovery route never submits Stellar.
- The protected admin UI starts this search automatically after a terminal-state preflight and offers a hash-free retry if history is not yet available. It never asks an admin to find or paste a transaction hash.

## Regression and validation evidence

- Automatic Horizon discovery, server RPC verification, and no-write outcomes: 39 recovery tests pass. The administrator detail suite passes 105 tests, including automatic reconciliation after terminal preflight and hash-free retry when Horizon has not indexed the resolution yet.
- Full web suite: 579 passed across 42 files.
- Full backend suite: 531 passed across 23 files.
- Web TypeScript and backend Convex TypeScript checks pass.
- Web production build (`pnpm --filter web build`) passes.
- Scoped Oxlint exits 0 with nine existing React refs/effect warnings; scoped Oxfmt and `git diff --check` pass.
- No contract or database schema changes were made.
- No contract or schema changes were made.

## Limits

The chain inspection was read-only. Regression tests use mocked Horizon/RPC and local Convex test state; they do not prove live Convex propagation or production deployment. No Convex record was repaired, no transaction was submitted, and no app/backend deployment was performed. The search is bounded to 2,000 recent transactions if the dispute-mark transaction cannot be loaded as a ledger anchor; RPC verification also depends on transaction history still being available. Highrable has no continuously maintained historical transaction indexer.
