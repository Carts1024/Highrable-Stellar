---
title: Highrable Instawards Deliverable 3 C06 — Creation Rejection and Atomicity Evidence
type: delivery-evidence
status: verified
last_updated: 2026-10-13
source_of_truth: packages/backend/tests/fixtures/disputes.ts and dispute regression suites
---

# Deliverable 3 C06 — Creation Rejection and Atomicity Coverage

## Result

C06 strengthens the existing C05 authorization, C08 evidence, and C09 creation
regression suites without changing production Convex code, the public API,
schema, statuses, frontend, contracts, authentication, deployment state, or
wallet-possession boundary.

The shared `snapshotDisputeCreationState` fixture is typed with complete
Convex documents for attachments, conversations, deadline audit events and
reminders, disputes and dispute events, escrows, jobs, messages, milestones,
notifications, revision requests, work submissions, and work agreements,
versions, and events. Equality therefore includes `_id`, `_creationTime`, and
all persisted timestamps and optional fields; it is not a row-count check.

## Baseline and additions

The implementation plan supplied a current baseline of 363 tests across 13
files. The focused command measured 143 passing tests across the three C05,
C08, and C09 files immediately before this change and 143 after it. The full
backend run measured 364 passing tests across 13 files after the change.

| Area | Regression coverage strengthened |
| --- | --- |
| C05 authorization | Existing eligibility, canonical parent/participant selection, parent graph, assignment/ownership, escrow-status, duplicate, alias, and conflict matrices now use the shared complete snapshot. |
| C08 evidence | Raw attachment and related-record limits, wrong-table/ownership/association errors, revision-linked submission failures, hidden messages, conversation parent/participant mismatches, deadline isolation, terminal writes, and mixed valid/invalid writes assert exact errors and unchanged complete documents. |
| C09 creation | Direct-conversation rejection, missing/wrong-table submissions, participant and escrow-link conflicts, raw limits, hidden messages, and deadline isolation seed valid attachment/agreement context, snapshot after the invalid condition, and compare the complete graph before and after `createDispute`. |

Successful creation and eligibility matrices remain in their existing suites;
no duplicate C06 test file or production helper was added.

## Acceptance mapping

- Rejected authorization and parent-selection calls preserve all existing
  dispute, related-record, parent, agreement, event, notification, message,
  and deadline documents.
- Related-record validation is tested after valid attachment and accepted
  agreement context is present, so a regression that writes an agreement
  version, opening record, attachment link, or side effect before rejection is
  observable.
- Missing and wrong-table IDs, participant and parent conflicts, revision
  references to missing submissions, hidden messages, conversation mismatches,
  deadline isolation, and input-limit boundaries each require their expected
  rejection message and exact before/after document equality.
- Caller-supplied wallets remain participant identifiers only; these local
  tests do not prove wallet possession.

## Validation commands and results

Commands were run from the repository root on 2026-10-13:

```text
pnpm --filter @repo/backend exec vitest run tests/disputes/c05.authorization.test.ts tests/disputes/c08.evidence.test.ts tests/disputes/c09.creation.test.ts
  3 files passed; 143 tests passed

pnpm --filter @repo/backend test
  13 files passed; 364 tests passed

pnpm --filter @repo/backend exec tsc --project convex/tsconfig.json --noEmit
  passed

pnpm --filter @repo/backend exec tsc --project tests/tsconfig.json --noEmit
  passed

pnpm exec oxlint packages/backend/tests/fixtures/disputes.ts packages/backend/tests/disputes/c05.authorization.test.ts packages/backend/tests/disputes/c08.evidence.test.ts packages/backend/tests/disputes/c09.creation.test.ts
  passed

pnpm exec oxfmt --check packages/backend/tests/fixtures/disputes.ts packages/backend/tests/disputes/c05.authorization.test.ts packages/backend/tests/disputes/c08.evidence.test.ts packages/backend/tests/disputes/c09.creation.test.ts
  passed; all files use the repository format
```

This is deterministic local `convex-test` evidence. It does not establish
live Convex deployment behavior, Stellar RPC state, transaction signing or
submission, deployed contract identity, or a live-chain dispute lifecycle.
