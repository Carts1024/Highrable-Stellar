# Highrable Instawards Deliverable 2 — Implementation Review

**Review window:** Git reachability range after cfe242c48bb6029f735538ee6947838128b1955b through fe4102b (HEAD)<br>
**Baseline commit date:** October 5, 2026<br>
**Review snapshot:** October 9, 2026<br>
**Related scope:** [Instawards SOW](./Highrable-Instawards-SOW.md), Section 4.1, Deliverable 2 — Convex Dispute Backend; [Deliverable 2 sprint plan](./Highrable-Instawards-Deliverable-2-Sprint-Plan.md)

## Executive summary

At the baseline commit, Highrable already had the central dispute workflow: Convex dispute and event records, participant actions, administrator review and assignment, Soroban marking callbacks, and persisted settlement attempts. The work in this review range strengthens that foundation and adds cross-layer acceptance coverage. It does not represent the first implementation of every Deliverable 2 feature.

The most consequential changes are:

- stricter validation and canonicalization of dispute evidence and related records;
- safer, phase-aware on-chain marking failure and retry guidance;
- typed and fail-closed normalization of Soroban RPC records;
- verification of saved settlement transactions during recovery, without resubmission;
- a read-only tool for comparing local escrow and reputation WASM with deployed contracts;
- participant and administrator integration tests that cover access changes, uncertain transactions, and final recovery states.

The reviewed implementation and local regression evidence are substantial. Live Testnet identity verification, five complete Testnet dispute lifecycles, reviewer-environment evidence, and a complete production build are not established by this range. Deliverable 2 should therefore be described as implemented and locally exercised, with live acceptance evidence still pending.

## Review scope and accounting

The baseline is commit cfe242c48bb6029f735538ee6947838128b1955b, titled “C01 dispute interface compatibility coverage.” The head is fe4102b, which merges pull request #109 into instawards/week2.

The Git reachability range contains **62 descendant commits**: **26 non-merge commits** and **36 merge or branch-synchronization commits**. The cumulative tree diff changes **93 files**, with **15,666 insertions and 1,006 deletions**. Commit dates on side branches can precede the baseline commit date; the range is defined by ancestry, not by filtering commits on their authored timestamps.

This review used the cumulative source diff, commit subjects and changed paths, the Deliverable 2 evidence notes, and relevant repository knowledge-vault notes. It did not run tests. Test totals below are transcribed from checked-in evidence reports and are identified as local evidence.

## Highrable before this range

As of the baseline, the dispute feature was already a multi-layer product workflow:

| Layer | State at baseline |
| --- | --- |
| Convex records | The disputes and disputeEvents tables already represented participants, parent work, evidence, review status, on-chain marking state, transaction hashes, and settlement results. disputeAdmins, disputeAdminOperations, disputeAssignmentEvents, and settlementAttempts also already existed. The dispute schema included assignment fields and the administrator-assignment index. |
| Participant workflow | Participants could open a case, attach evidence, respond, and use marking callbacks to reflect Soroban transactions in Convex. |
| Administrator workflow | The source already included scoped dispute-admin membership, case assignment, review/status operations, and settlement-attempt lifecycle records. Some legacy dispute-level moderator mutations remained rejecting placeholders; active review and settlement operations lived under the admin API. |
| Soroban boundary | The escrow supported dispute marking and resolution. Convex and the browser used callbacks and RPC reads to coordinate application records with contract state. |
| Recovery foundation | Callback phases, transaction history, and settlement-attempt recovery already existed. The range adds stronger checks and broader regression evidence at these boundaries. |
| Main gaps addressed by this range | Related evidence and parent links needed stronger validation; RPC results needed stricter identity and shape checks; saved settlement recovery needed more complete verification; marking failures needed guidance that reflected whether a transaction hash was already known; and important cross-layer states needed acceptance tests. |

The schema and indexes are important baseline facts: this range does not add a dispute-schema migration. Its main backend effect is stronger validation and recovery behavior around existing records and APIs.

## Implementations delivered

### Backend records, permissions, and evidence

Deliverable 2 C02 pins the generated public dispute API contract through tests. Coverage checks schema validators and indexes, exported function names and arguments, malformed or wrong-table IDs, and stable participant-query result shapes. It preserves the boundary where active administrator review and settlement functions are exposed through api.admin.

The C08 evidence work strengthens existing dispute creation and evidence paths. The backend now:

- checks raw attachment counts before deduplicating IDs, then validates the canonical deduplicated list;
- requires attachments to exist, be active, belong to the acting participant, and not be attached to a conflicting record;
- validates related submissions, revisions, messages, and deadline events against the selected work, participants, and parent links;
- rejects unrelated or conflicting context before writing the dispute, reassociating evidence, or adding the opening event;
- uses normalized IDs consistently in the dispute record, attachment links, and audit event.

These checks keep the audit and evidence graph aligned with the selected micro-gig or milestone. C02 and C08 do not add new persisted tables or change the public lifecycle model.

### Marking callbacks and retries

The marking callbacks preserve the existing not_marked, marking, marked, and mark_failed states. The callback path remains authorization-first and phase-guarded: duplicate starts and matching replays are idempotent; conflicting hashes, stale failures, and impossible transitions are rejected; accepted changes do not replay notifications or audit side effects.

C14 improves failure communication. When a transaction hash is already recorded, audit events, system messages, and notifications retain that hash and direct the user to reconciliation. When no hash is known, the message says to retry only if the operation was not submitted; otherwise the outcome must be reconciled first. This avoids prompting a blind retry while a transaction outcome may be uncertain.

### Settlement attempts and transaction recovery

The settlement-attempt data model and principal callback workflow predate the baseline. The reviewed work adds substantial regression coverage for their invariants and hardens the recovery boundary:

- one active settlement attempt per escrow, fixed actor and resolution terms, operation ID, signed transaction hash/expiry, and explicit attempt phases;
- matching replays remain harmless, while competing starts and conflicting transaction identities are rejected;
- a signed or submission-unknown attempt stays locked until its saved transaction can be resolved;
- recovery validates the saved transaction hash and expected contract invocation, as well as the escrow state required for finalization;
- malformed or mismatched RPC results leave the attempt recoverable and do not finalize Convex records;
- recovery does not submit or resubmit a Stellar transaction.

C21 integration tests also exercise downstream bookkeeping: transaction records, audit events, notifications, system messages, escrow status, milestone/job aggregation, and rollback when a required parent record is absent. The settlement state remains owned by the administrator settlement path; generic escrow sync can recover the mirror to disputed but cannot finalize it.

### Soroban RPC normalization

The changes in [Stellar reads](../../packages/backend/convex/lib/stellarReads.ts) replace permissive casts with explicit checks. Reads validate that:

- the returned escrow or completion record identifies the requested escrow;
- integer values are safe, non-negative, and within contract numeric bounds;
- contract addresses parse as valid Stellar addresses;
- hashes have the expected 32-byte length;
- completion ratings and escrow status values are valid, including rejection of unknown or prototype-named values.

A missing completion remains a normal null result. A malformed completion or escrow record follows the existing recoverable read-failure path instead of being treated as valid data. On a failed read, sync does not advance escrow, job, or milestone state; a later valid read can recover the mirror.

### Deployment identity check

Deliverable 2 C20 adds [scripts/verify-deployment-identity.mjs](../../scripts/verify-deployment-identity.mjs) and the contracts:verify:identity / contracts:test:identity commands. The verifier:

1. accepts the intended backend network, RPC endpoint, escrow ID, and reputation ID plus build/test provenance;
2. hashes the selected local WASM files and validates their format;
3. uses read-only Stellar RPC calls to check network identity, contract instances, deployed WASM hashes and bytes, reciprocal escrow/reputation links, and a second instance read for changes during the check;
4. returns matched, mismatch, or unknown with sanitized evidence and distinct exit codes.

The build and test provenance is operator-supplied. The verifier independently hashes the local artifact, but cannot prove that a claimed source revision produced it or that the claimed tests ran. A successful match is a point-in-time identity check; it is not a complete readiness certification.

### Contract and frontend integration work in the same sprint range

The sprint range contains work in all four engineering areas, which helps validate the backend contract end to end:

- **Soroban:** dispute-state guard regressions and a settlement arithmetic fix that avoids intermediate overflow using quotient/remainder arithmetic.
- **Participant interface:** evidence and response composition, draft preservation, accessible loading/error feedback, and consistent marking states after an uncertain submission or confirmed result.
- **Administrator interface:** centralized evidence review, stricter assignment/review controls, session validation, and a guard against continuing settlement with a stale wallet context.
- **Integration coverage:** participant and administrator acceptance journeys link real UI composition to generated API types and backend state contracts. Wallet, upload, Convex transport, or RPC boundaries are mocked where stated in the evidence notes.

This work improves the handoff between the Convex backend, participant UI, administrator UI, and Soroban escrow. It does not establish a live browser-to-Testnet run.

## Deliverable flow after the changes

| Step | System behavior |
| --- | --- |
| 1. Open and respond | Client or freelancer uses the participant interface; Convex validates participants, work context, and evidence before writing the dispute and audit records. |
| 2. Mark on-chain | The participant signs and submits the escrow marking transaction; phase-guarded callbacks update Convex and send audit/notification side effects once. |
| 3. Review and settle | An authorized administrator reviews the assigned case and creates a persisted settlement attempt with immutable actor and terms. |
| 4. Recover | The trusted recovery boundary checks the saved transaction and escrow state through RPC; it never submits the transaction again. |
| 5. Finalize | Convex applies the verified settlement to the dispute and related escrow/job/milestone records. Generic sync can recover an escrow mirror to disputed, while administrator settlement owns terminal finalization. |

Convex remains the application workflow and audit store; Soroban remains authoritative for escrow state. The backend does not ingest escrow dispute events through an indexer in this implementation. The workflow relies on transaction callbacks and RPC reads, so contract events do not automatically populate the Convex timeline.

## Highrable after this range

| Area | State at fe4102b |
| --- | --- |
| Dispute workflow | Participant case, evidence, response, timeline, marking, administrator assignment/review, and settlement paths are integrated in source. |
| Backend integrity | Evidence references are checked against ownership and work context; marking callbacks and settlement attempts have extensive idempotency and authorization coverage. |
| Chain reads and recovery | RPC records are normalized and validated. Saved settlement recovery verifies the expected transaction and does not resubmit it. |
| Data compatibility | Existing schema and indexes remain in place; no new migration is introduced by the reviewed range. |
| Cross-layer behavior | Participant and administrator states have local integration and acceptance coverage for access changes, pending/uncertain outcomes, and recovery. |
| Deployment identity | A read-only verifier is implemented and locally tested. A live match against the intended backend deployment is not recorded. |
| Testnet demonstration | No evidence in this range establishes five complete Testnet dispute lifecycles or the required set of Stellar Expert transaction links. |
| Production readiness | The C24 evidence records that the canonical Next.js build compiled and type-checked, but page-data collection failed because the pre-existing local environment had blank contract IDs, hashes, and optional server settings. A complete production build is not verified. |

## Evidence reported in the repository

The following figures are recorded in linked local evidence notes; they were not rerun during this documentation review.

| Evidence | Reported result | What it establishes |
| --- | --- | --- |
| Deliverable 2 C19 backend RPC reconciliation | 31 focused tests; full backend suite then reported 361 tests across 13 files | Local Convex behavior with mocked RPC simulation, including malformed records and recovery. |
| Deliverable 2 C19 settlement recovery | 27 focused web route/SDK tests | Saved transaction verification using real SDK envelopes with mocked RPC and Convex transport; assertions prohibit transaction submission. |
| Deliverable 2 C20 deployment identity | 49 verifier tests | Local input validation and RPC/XDR decoding against a loopback fixture and synthetic WASM; not production artifact or live deployment verification. |
| Deliverable 2 C22 participant integration | 60 tests across 10 files in its evidence report | Local participant composition, access changes, form behavior, timeline recovery, and accessibility semantics. |
| Deliverable 2 C23 administrator acceptance | Administrator suite reported 200 tests across 7 files; protected integration reported 30 tests | Local protected queue/detail/settlement recovery behavior with controlled signing and transport seams. |
| Deliverable 2 C24 final handoff | 346 web tests across 24 files; 361 backend tests across 13 files; 49 verifier tests | Final reported local suite totals. The participant and administrator subsets are included in the web total, not additive to it. |

These results exceed the raw 20-test project minimum in local suite quantity. A consolidated acceptance report still needs to map the required contract, backend, participant, and administrator categories and pair them with Testnet evidence.

## Sprint-wide impact and acceptance status

Deliverable 2 serves as the application-state and recovery anchor for the whole Dispute Management Module. It gives participant and administrator interfaces explicit validation, permission, phase, and transaction-identity contracts. It also gives the Soroban side a defined RPC verification boundary. The C21–C24 work turns those contracts into connected local acceptance paths.

| SOW objective | Contribution from this range | Remaining acceptance evidence |
| --- | --- | --- |
| Protected Convex dispute lifecycle | API contract tests, evidence validation, authorization/callback regression coverage, audit and notification invariants | Reviewer deployment and a consolidated backend test report mapped to the SOW. |
| Soroban synchronization and recovery | Validated RPC records, recoverable sync behavior, saved-transaction verification, no-resubmission recovery | Live RPC verification against intended contract IDs and five complete Testnet lifecycles. |
| Participant and administrator workflows | Shared state/permission contracts, stale-wallet protection, accessible failure recovery, linked acceptance journeys | Reviewer-accessible environment and screenshots/recording from an end-to-end run. |
| Deployment/code identity | Read-only verifier implementation and 49 local tests | Actual optimized WASM, accurate build/test provenance, matching backend scope, and a recorded live verifier result. |
| Completion evidence | API, contract, integration, and recovery evidence notes plus commit history | Required Stellar Expert links, consolidated acceptance package, and proof of the required role-attributed merged pull requests. |

The range contains merged and synchronized development history on instawards/week2 and developer/frontend refs. The history alone does not prove every role-specific branch and attribution item required by the SOW. The verified implementation and tests are useful sprint progress; they do not by themselves close the live-chain or reviewer-evidence criteria.

## Known boundaries

- Public participant mutations still receive wallet addresses as arguments; that input alone is not cryptographic proof that the caller possesses the wallet.
- There is no Soroban event indexer or backend event-ingestion path for dispute events. Convex’s timeline is built from application callbacks and records.
- Hash absence does not prove a Stellar transaction was never submitted. Callback correlation across separate hashless attempts remains limited because there are no per-attempt IDs for that marking operation.
- Deployment identity depends on accurate operator-provided build/test provenance and actual optimized WASM. Neither a live deployment match nor those artifacts are recorded in the C20 evidence.
- Local integration tests mock some wallet, upload, Convex transport, and RPC boundaries; they do not replace browser-to-Testnet verification.

## Source map

| Concern | Primary source and evidence |
| --- | --- |
| Dispute validation and mutations | [Dispute helpers](../../packages/backend/convex/disputes/helpers.ts), [dispute mutations](../../packages/backend/convex/disputes/mutations.ts) |
| Soroban record normalization | [Stellar reads](../../packages/backend/convex/lib/stellarReads.ts) |
| Backend API/state regression | [Backend dispute tests](../../packages/backend/tests/disputes/), [C02 API handoff](./C02-Backend-Contract-Handoff.md), [C21 reconciliation evidence](./C21-Dispute-Reconciliation-Evidence.md) |
| Saved settlement recovery | [Admin chain verification](../../apps/web/core/admin/chain-verification.ts), [settlement recovery tests](../../apps/web/core/admin/settlement-recovery.test.ts), [C19 RPC recovery evidence](./Deliverable-2-C19-RPC-Recovery-Evidence.md) |
| Deployment identity | [Verifier](../../scripts/verify-deployment-identity.mjs), [verifier tests](../../scripts/verify-deployment-identity.test.mjs), [C20 evidence](./Deliverable-2-C20-Deployment-Identity-Evidence.md) |
| Participant integration | [Dispute UI feature](../../apps/web/features/disputes/), [C22 evidence](./Deliverable-2-C22-Participant-Integration-Evidence.md), [C24 evidence](./Deliverable-2-C24-Participant-Acceptance-Evidence.md) |
| Administrator integration | [Admin UI feature](../../apps/web/features/admin/), [C23 evidence](./Deliverable-2-C23-Admin-Acceptance-Evidence.md) |
| Contract regression and arithmetic | [Escrow contract](../../contracts/escrow/src/lib.rs), [escrow tests](../../contracts/escrow/src/test.rs) |
| Current product boundaries | [Disputes and Cancellations vault note](../obsidian/modules/Disputes%20and%20Cancellations.md), [Sync and Transactions vault note](../obsidian/modules/Sync%20and%20Transactions.md) |

## Non-merge commit ledger

All 26 non-merge commits in the requested range are represented below. The 36 merge or branch-synchronization commits are included in the range totals and cumulative diff above.

| Commit | Contribution |
| --- | --- |
| dc1d340 | Participant evidence and response actions. |
| 2de8773 | Backend dispute reconciliation integration tests. |
| 2e2656e | Participant marking and recovery state guidance. |
| 98c9b53 | Participant flow and accessibility regressions. |
| 9d38d6d | Administrator regression coverage. |
| bc92196 | C06 escrow dispute-guard regression tests and documentation. |
| a959957 | Deliverable 2 C02 backend API and schema contract coverage. |
| bc017cd | C05 dispute authorization evidence documentation. |
| 1a7ea25 | Administrator session validation and error handling. |
| a1462bb | Dispute route test coverage and documentation. |
| 9aff6b2 | C07 dispute-marking regression tests. |
| 28d6cb9 | C08 evidence validation and hardening. |
| 2014bb3 | Participant action session preserves drafts during recovery. |
| 7d729d9 | Dispute integration and timeline test coverage. |
| 31ae6da | Centralized administrator evidence review and refresh. |
| ab073b2 | Assignment and review policy hardening. |
| 8ffd83a | Marking callback failure guidance and retry logic. |
| 7d3ff5d | C17 settlement-attempt regression coverage. |
| 29c0a57 | C13 escrow dispute-state guard regression tests. |
| c311a00 | Settlement arithmetic avoids intermediate overflow. |
| cc779dd | Deliverable 2 C19 RPC record validation and settlement recovery. |
| e742265 | Deliverable 2 C20 read-only deployment identity verifier. |
| efffc4b | Deliverable 2 C21 prevents stale-wallet settlement execution. |
| b974d56 | Deliverable 2 C22 participant integration and accessibility coverage. |
| e3f8c5b | Deliverable 2 C23 protected administrator acceptance path. |
| 7f918b3 | Deliverable 2 C24 participant acceptance feedback and recovery correction. |

### Merge and synchronization commit ledger

These 36 commits integrate the work above into week1, week2, developer, and frontend refs. They are included in the reviewed Git range.

| Commit | Merge or synchronization |
| --- | --- |
| 2805d04 | Pull request #75 from instawards/week1. |
| d194093 | Pull request #77 from instawards/week1. |
| a14216e | Pull request #78 from instawards/week1. |
| 1177619 | Pull request #79 from dev/bette. |
| 74d6d21 | Pull request #80 from dev/sherwin. |
| f0c0eba | Pull request #81 from dev/carl. |
| 71b9745 | Merged week1 into dev/christelle. |
| d6b3978 | Pull request #82 from dev/christelle. |
| a473283 | Merged week1 into frontend. |
| 2c8a498 | Pull request #84 from frontend. |
| 601c9c3 | Pull request #86 from dev/carl. |
| f42369d | Pull request #87 from week2. |
| 2b1a851 | Pull request #88 from week2. |
| 8d393d2 | Pull request #89 from week2. |
| 8950193 | Pull request #90 from dev/bette. |
| b0f97cd | Pull request #91 from dev/carl. |
| 142e962 | Merged week2 into dev/christelle. |
| 31660f7 | Pull request #92 from dev/christelle. |
| 5a842cb | Merged dev/bette into week2. |
| e86cf5b | Pull request #93 from week2. |
| d2da951 | Pull request #94 from week2. |
| 3949d81 | Pull request #95 from week2. |
| e784970 | Pull request #97 from dev/bette. |
| 736cfb2 | Pull request #98 from dev/carl. |
| 4a234d9 | Merged week2 into dev/christelle. |
| 6fa3e35 | Pull request #99 from dev/christelle. |
| 593b911 | Merged week2 into frontend. |
| b70282d | Pull request #100 from frontend. |
| ac40c40 | Pull request #102 from week2. |
| 98162ac | Pull request #103 from week2. |
| 7841637 | Pull request #104 from week2. |
| dd391bc | Pull request #106 from dev/carl. |
| 4d18d84 | Merged week2 into dev/christelle. |
| 8726bef | Pull request #107 from dev/christelle. |
| c5a4db9 | Pull request #108 from week2. |
| fe4102b | Pull request #109 from dev/sherwin; current HEAD. |
