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

The later `Released` state is therefore consistent with the confirmed resolution. The chain evidence does not establish why the corresponding product bookkeeping was absent or whether the successful transaction was submitted by this application. No saved attempt was available to use for ordinary signed-transaction recovery.

## Fix

- The resolve API accepts a supplied external transaction hash only after preflight confirms the persisted dispute still has a disputed Convex escrow mirror.
- The server verifies RPC success, transaction hash/envelope, configured network and contract scope, exact `resolve_dispute` call, assigned admin argument, escrow ID, share bounds, and transaction expiry. It then verifies current escrow participants and that the current terminal status matches the transaction's share.
- Convex creates or attaches a signed settlement attempt and invokes the existing success mutation for normal transaction, escrow, dispute, event, and notification bookkeeping. The recovery route never submits Stellar.
- The protected admin UI exposes the hash entry only after preflight reports terminal chain state. Invalid or mismatched evidence leaves settlement bookkeeping unchanged.

## Regression and validation evidence

- Web recovery, route, and UI tests: 174 passed across 3 files.
- Full web suite: 576 passed across 42 files.
- Backend settlement bookkeeping tests: 9 passed, including assigned-admin authorization and preservation of a conflicting saved hash.
- Full backend suite: 531 passed across 23 files.
- Web TypeScript (`pnpm --filter web exec tsc --noEmit`): passed.
- Backend Convex TypeScript (`pnpm --filter @repo/backend exec tsc --project convex/tsconfig.json --noEmit`): passed.
- Web production build (`pnpm --filter web build`): passed.
- Monorepo build (`pnpm build`): passed; Turborepo ran the web production build successfully.
- Scoped Oxlint: passed with nine existing React refs/effect warnings and no errors; scoped Oxfmt and `git diff --check` passed.
- No contract or schema changes were made.

## Limits

The chain inspection was read-only. Regression tests use mocked RPC and local Convex test state; they do not prove live Convex propagation or production deployment. No Convex record was repaired, no transaction was submitted, and no app/backend deployment was performed. The recovery remains operator-supplied hash verification because Highrable has no general historical transaction indexer.
