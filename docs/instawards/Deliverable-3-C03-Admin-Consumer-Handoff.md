---
title: Deliverable 3 C03 — Administrator Consumer Contract Handoff
type: handoff
area: frontend-admin
status: current
last_updated: 2026-10-13
source_of_truth: repository source, generated Convex types, and tests
---

# Deliverable 3 C03 — Administrator Consumer Contract Handoff

## Baseline gap and scope

The administrator aliases, generated Convex result types, and protected queue/detail API clients already existed. Existing administrator tests covered page behavior and transport errors, but there was no dedicated consumer contract proving that newly created participant cases could be consumed as typed administrator records across both parent kinds. The missing evidence was the relationship between canonical participant fields, initial case state, parent references, opening events, evidence resolution, nullable parents, and forbidden TypeScript shapes.

C03 adds only `apps/web/features/admin/admin-consumer.contract.test.ts`. It does not change production APIs, runtime validators, schemas, generated Convex output, participant components, wallet code, or contracts. Its negative cases are compile-time TypeScript assertions; they must not be described as runtime payload validation.

## Test mapping

| Contract concern | C03 evidence |
| --- | --- |
| Participant-created cases | Typed client-opened micro-gig and freelancer-opened milestone fixtures preserve `open`, `not_marked`, canonical wallets, parent IDs, and `dispute_opened` timeline events. |
| Queue projection | `IAdminDisputeListItem` fixtures lock dispute ID/number, title, both statuses, reason, participant wallets, timestamps, and the generated assignment fields. |
| HTTP envelope and reads | `IAdminDisputesResponse` locks `{ disputes }`; `fetchAdminDisputes` and `fetchAdminDispute` are exercised with typed mocked responses, credentials, `cache: "no-store"`, query filters, and decoded JSON. |
| Detail result | `IAdminDisputeDetail` locks `dispute`, `timeline`, `assignmentEvents`, `settlementAttempts`, and nullable `job`, `milestone`, and `escrow` records. |
| Evidence semantics | Case evidence keeps attachment IDs separate from resolved attachment records; resolved records allow `url: null`; missing IDs are not fabricated into resolved attachments. Timeline evidence separately keeps event attachment IDs and resolved event attachments, including a participant serialized protection shape. Related submission, revision, message, and deadline references retain their optional/typed forms. |
| Shared vocabulary | The generated participant/admin fields are compared directly. The exact eight dispute statuses, four on-chain marking statuses, four actor roles, and three administrator-writable review targets are asserted without creating a second status model. |
| Forbidden shapes | TypeScript rejects a missing required dispute field, an attachment ID in a `jobId` slot, an invalid status, an incorrect queue envelope, and unsupported `null` queue/detail results. Narrow synthetic ID casts are isolated in the ID helper; fixtures are not whole-object casts. |
| Access and empty states | Empty queues remain `{ disputes: [] }`, while HTTP 401/403/404 responses reject with `AdminApiError` instead of becoming an empty or nullable result. |

## Current API and result contracts

Administrator browser code consumes the protected HTTP clients in `apps/web/features/admin/lib/admin-api.ts`:

- `GET /api/admin/disputes` accepts the existing status, on-chain status, assignment filter, and bounded limit query parameters and returns `{ disputes: TAdminDisputeQueueQueryResult }`.
- Queue rows are the generated `api.admin.listAdminDisputes` projection: `disputeId`, `disputeNumber`, `title`, `status`, `onChainStatus`, `reasonCategory`, `clientWallet`, `freelancerWallet`, `openedAt`, `updatedAt`, `assignedAdminWallet`, and `assignedAt`.
- `GET /api/admin/disputes/[disputeId]` returns `IAdminDisputeDetail`, generated from `api.admin.getAdminDispute`: `dispute`, `timeline`, `assignmentEvents`, `settlementAttempts`, and nullable `job`, `milestone`, and `escrow` parent records.
- Queue/detail reads use `credentials: "include"` and `cache: "no-store"`. HTTP 401, 403, and 404 remain typed `AdminApiError` failures. An empty queue is a successful `{ disputes: [] }` result, not a failure.

The administrator aliases in `features/admin/types.ts` and participant aliases in `features/disputes/types.ts` continue to derive from `@repo/convex-client`. The C03 test imports those aliases and `TConvexDoc`/`TConvexId`; it does not introduce parallel generated shapes.

## Status, identity, and evidence vocabulary

The shared generated dispute status vocabulary is exactly:

`open`, `under_review`, `awaiting_client_response`, `awaiting_freelancer_response`, `resolved_client`, `resolved_freelancer`, `split_resolution`, and `cancelled`.

The shared on-chain marking vocabulary is exactly `not_marked`, `marking`, `marked`, and `mark_failed`. The existing actor-role vocabulary is `client`, `freelancer`, `moderator`, and `system`. Administrator review writes target the existing three nonterminal review statuses: `under_review`, `awaiting_client_response`, and `awaiting_freelancer_response`; this is a writable subset, not a replacement for the eight-value dispute status union.

Case evidence is represented by the dispute's `evidenceAttachmentIds` plus the administrator-resolved `dispute.attachments` array. A stored ID can be missing from the resolved array, and a resolved attachment can have a nullable storage `url`; a nullable URL is not itself a failed read. Timeline evidence follows the same distinction per event through `attachmentIds` and `attachments`. Related submissions, revisions, messages, and deadline events remain references on the dispute and are not folded into attachment records.

## Session, error, and recovery states

The protected administrator surface requires the verified external-wallet session and administrator capability path. A session or data read returning 401/403 closes or refuses protected content; 404 is a not-found detail result; a successful empty queue remains an explicit empty state; network and 5xx reads are the retryable read class used by the existing admin client. The C03 transport tests cover rejection for 401/403/404 and do not weaken those boundaries.

Read retry and transaction recovery are different operations:

- A read retry repeats the same queue/detail HTTP GET after a recoverable read failure. It does not repeat a prior mutation.
- Transaction recovery verifies or reconciles an already-started Stellar marking/settlement operation and its persisted identity. It is not a queue/detail refetch and must not be inferred from a successful mocked GET.

C03 covers the first boundary only. It does not execute Stellar, Convex authorization, participant creation, or settlement recovery.

## Ownership and branch override

This work was performed on the selected current-branch override `instawards/dev/bette`, not by changing production ownership boundaries.

- C03 test and administrator consumer-contract evidence remain Frontend Developer 1 / administrator-owned: `apps/web/features/admin/admin-consumer.contract.test.ts`.
- Participant routes, components, and participant-facing tests remain Developer 2-owned under `apps/web/app/disputes/` and the participant portions of `apps/web/features/disputes/`.
- Backend functions, schemas, generated Convex output, and shared-contract changes remain backend/shared ownership and require coordination. C03 made none of those changes.

The older [C06 Frontend Handoff](./C06-Frontend-Handoff.md) is superseded for the operational details that it described at its earlier freeze: current administrator session/error behavior, current settlement/recovery boundaries, and this C03 test-file ownership/branch override. Its generated-type references, shared status vocabulary, and participant caller-supplied-wallet limitation remain historical reference points. This document intentionally does not copy C06's older session, settlement, or ownership narrative as current C03 evidence.

## Validation results

Executed on 2026-10-13 from `instawards/dev/bette`:

| Command | Result |
| --- | --- |
| `pnpm --filter web test features/admin` | PASS — 8 files, 238 tests. |
| `pnpm --filter web exec tsc --noEmit` | PASS. This check is required for the compile-time negative assertions. |
| `pnpm --filter web test` | FAIL — 26 of 27 files passed; 412 of 414 tests passed. Two existing failures are in `features/disputes/components/dispute-participant-integration.test.tsx`; both expect the older `Escrow dispute marking is confirmed on Stellar.` text while the current participant UI renders `Outcome Pending` or `Recording Confirmation` during the tested recording/reconciliation states. |
| `pnpm --filter web exec oxlint features/admin/admin-consumer.contract.test.ts` | PASS — 0 warnings, 0 errors. |
| `pnpm --filter web exec oxfmt --check features/admin/admin-consumer.contract.test.ts` | PASS. |

The initial focused run also encountered the sandbox's Vitest/esbuild `spawn EPERM`; the required focused and full commands were rerun with approved elevated process permissions. The final focused result above is green. No C03 production change explains the two full-suite participant failures; they are recorded rather than repaired in this administrator-owned task.

## Explicit limitations

These are typed fixtures and mocked HTTP transports. They do not prove participant case creation, backend authorization, signed wallet possession, participant identity proof, administrator capability enforcement in Convex, live RPC behavior, wallet signing, deployed contract compatibility, or live-chain execution. They also do not replace broader integration coverage: C07 and C19 retain the wider administrator/cross-interface integration responsibilities in the Deliverable 3 plan.
