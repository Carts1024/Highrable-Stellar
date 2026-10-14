---
title: Highrable Instawards Deliverable 3 C02 — Participant API Contract Evidence
type: delivery-evidence
status: verified
last_updated: 2026-10-13
source_of_truth: packages/backend/tests/disputes/api.contract.test.ts and current Convex source
---

# Deliverable 3 C02 — Participant API Contract Coverage

## Result

C02 extends the existing Convex dispute contract tests on the
`instawards/dispute-backend` branch. The change is limited to
`packages/backend/tests/disputes/api.contract.test.ts` and supporting
documentation. It does not change production Convex functions, schema fields,
indexes, generated files, frontend code, Soroban contracts, dependencies,
deployment configuration, or environment values.

The supplied sprint requirements are mapped here without independent SOW
verification: the referenced `docs/instawards/Highrable-Instawards-SOW.md` is
not present in this checkout. The historical [Deliverable 2 C02 backend
handoff](./C02-Backend-Contract-Handoff.md) is preserved and not rewritten.

## Baseline and distinct additions

The existing C02 baseline was 59 passing tests across
[`api.contract.test.ts`](../../packages/backend/tests/disputes/api.contract.test.ts),
[`schema.contract.test.ts`](../../packages/backend/tests/disputes/schema.contract.test.ts),
and [`index.contract.test.ts`](../../packages/backend/tests/disputes/index.contract.test.ts).
C02 adds three focused test cases, bringing that run to 62 passing tests across
the same three files.

| Addition | Coverage | Reused behavioral evidence |
| --- | --- | --- |
| Generated API surface | Compile-time equality for the generated `api.disputes` key set, plus runtime `getFunctionName` assertions for all 20 public dispute references. | Existing public-export and legacy-placeholder checks remain in `api.contract.test.ts`. |
| Participant type contract | `FunctionArgs` and `FunctionReturnType` assertions for ten participant queries and six creation/evidence/response/marking mutations; local expected types lock required/optional fields, typed IDs, mutation returns, query nullability, attachment enrichment, permission-result shapes, and the four contract vocabularies. | `schema.contract.test.ts` and `transitions.test.ts` retain schema/state behavior; no application type was added. |
| Validator drift | Real `convex-test` calls pass otherwise-valid participant inputs with one unexpected top-level argument to all ten queries and six participant mutations. | Existing authorization, creation, evidence, and reconciliation matrices remain in C05/C08/C09/C13/C14/C19/C21 suites. |
| Rejected-write integrity | Every rejected mutation is compared against a complete snapshot of all current Convex tables before and after validation. | Domain-specific rollback assertions remain in the existing authorization, creation, evidence, and reconciliation suites. |

The new runtime cases use deterministic dispute fixtures and the real public
Convex functions. No handwritten test-only function implementation or mocked
authorization helper is used.

## Participant acceptance map

| Participant area | Public API surface | Generated contract evidence | Behavioral tests retained or referenced |
| --- | --- | --- | --- |
| Creation | `api.disputes.createDispute` | Required creation fields, optional evidence/related-record fields, typed attachment/submission/revision/message/deadline IDs, `v.id("disputes")` return | C02 validator/snapshot case; [`c05.authorization.test.ts`](../../packages/backend/tests/disputes/c05.authorization.test.ts) and [`c09.creation.test.ts`](../../packages/backend/tests/disputes/c09.creation.test.ts) cover eligibility, parent derivation, authorization, relationships, duplicates, and creation rollback. |
| Reads | `getDispute`, `getDisputeByParent`, `getActiveDisputeForEscrow`, `getDisputesForWallet` | Optional viewer fields, escrow/dispute IDs, nullability, raw document versus attachment-enriched results | C02 present/denied/missing result-shape coverage; C05 and existing participant/domain suites retain access and parent behavior. |
| Evidence | `addDisputeEvidence`, `getDisputeEvidence`, and `createDispute.evidenceAttachmentIds` | Required typed attachment array, optional message, boolean mutation result, serialized attachment URL/protection shape | C02 unexpected-argument and snapshot cases; [`c08.evidence.test.ts`](../../packages/backend/tests/disputes/c08.evidence.test.ts) and [`c19.participant-evidence.test.ts`](../../packages/backend/tests/disputes/c19.participant-evidence.test.ts) retain ownership, association, limits, protection, and rollback matrices. |
| Responses | `addDisputeResponse`, `canRespondToDispute` | Required responder/message fields, optional typed attachments, boolean result, permission role/reason union | C02 argument/result assertions; C08 and C19 retain participant authorization, evidence association, response side effects, and terminal-state behavior. |
| Timeline | `getDisputeTimeline` | Optional viewer, ordered event array with serialized attachments, exact event-type union and optional status fields through the event document | C02 enrichment and event-union assertions; existing backend dispute-event coverage and the participant timeline UI evidence remain separate. |
| Permissions | `canOpenDispute`, `canViewDispute`, `canRespondToDispute` | Exact argument fields and allowed/denied/missing result shapes, including null versus omitted role fields | C02 permission-shape and validator checks; C05 authorization and C19 participant evidence tests retain the role, parent, wallet, and revocation behavior matrices. |
| Statuses | `changeDisputeStatus`, `cancelDispute`, plus status fields returned by reads | Local exact dispute-status union: `open`, `under_review`, `awaiting_client_response`, `awaiting_freelancer_response`, `resolved_client`, `resolved_freelancer`, `split_resolution`, `cancelled` | Existing transitions and authorization suites cover legal state changes, terminal guards, and side effects; C02 does not duplicate those matrices. |
| Marking callbacks | `markDisputeOnChainStarted`, `markDisputeOnChainSucceeded`, `markDisputeOnChainFailed` | Required/optional transaction fields, typed dispute IDs, boolean returns, and exact marking-phase union: `not_marked`, `marking`, `marked`, `mark_failed` | C02 validator/snapshot cases; [`c13.idempotency.test.ts`](../../packages/backend/tests/disputes/c13.idempotency.test.ts), [`c14.marking.test.ts`](../../packages/backend/tests/disputes/c14.marking.test.ts), and [`c21.reconciliation.test.ts`](../../packages/backend/tests/disputes/c21.reconciliation.test.ts) retain transition, replay, known-hash, and reconciliation behavior. |

The local expected reason union is the current nine-value
`reasonCategory` vocabulary. The local event union is the current
`disputeEvents.type` vocabulary. These expected types intentionally live in
the test and do not compete with source validators or frontend aliases.

## Evidence boundaries

This is backend contract evidence: generated Convex API declarations are
checked at compile time, validator behavior runs through `convex-test`, and
the real composed schema and public functions execute against deterministic
in-memory state.

It is not evidence of:

- frontend accessibility, responsive behavior, route rendering, or browser
  interaction;
- wallet signing, private-key possession, passkey execution, transaction
  submission, or confirmation;
- Stellar RPC reads, Soroban event ingestion, deployed contract identity, or
  live-chain acceptance.

Participant functions continue to receive caller-supplied wallet addresses.
Role equality in these tests is not proof that the caller controls the wallet.
The separate [Deliverable 2 C24 participant acceptance evidence](./Deliverable-2-C24-Participant-Acceptance-Evidence.md)
remains the historical frontend acceptance handoff and is not replaced by C02.

## Validation commands and results

Commands were run from the repository root on 2026-10-13:

```text
pnpm --filter @repo/backend exec vitest run tests/disputes/api.contract.test.ts tests/disputes/schema.contract.test.ts tests/disputes/index.contract.test.ts
  3 files passed; 62 tests passed

pnpm --filter @repo/backend test
  13 files passed; 364 tests passed

pnpm --filter @repo/backend exec tsc --project convex/tsconfig.json --noEmit
  passed

pnpm --filter @repo/backend exec tsc --project tests/tsconfig.json --noEmit
  passed

pnpm exec oxlint packages/backend/tests/disputes/api.contract.test.ts
  passed

pnpm exec oxfmt --check packages/backend/tests/disputes/api.contract.test.ts
  passed; file uses the repository format
```

The separate test-project type-check is required because ordinary Vitest
execution does not verify `expectTypeOf` assertions. The passing backend suite
is deterministic local Convex evidence only; it does not establish frontend,
wallet, deployment, or live-chain acceptance.
