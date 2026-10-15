---
type: evidence
area: backend
status: verified-local
last_updated: 2026-10-14
source_of_truth: repository
---

# Deliverable 3 C14 — Participant Response Evidence

## Scope

C14 hardens the Convex participant response mutation without changing frontend implementation, Stellar contracts, environment configuration, deployment artifacts, or generated files.

- `addDisputeResponse` keeps its boolean result and adds optional `requestId` support.
- Supplied request IDs are trimmed; blank IDs and IDs longer than 128 characters reject.
- `disputeEvents.requestId` is optional, so existing events require no backfill.
- `by_dispute_actor_requestId` indexes `(disputeId, actorWallet, requestId)` for replay lookup.
- Current parent/participant authorization, active-status, sanitized-message, and attachment ownership/association checks run before replay detection.
- Matching keyed retries compare saved message, responder wallet type, and ordered deduplicated attachment IDs and return `true` without writes.
- Conflicting key reuse rejects atomically. New responses preserve existing evidence association, event attribution, opposite-participant notification content, review status, and no-conversation-message behavior.
- Timeline reads retain the existing ascending dispute index, tie ordering, protected attachment serialization, and first-200-event bound; replay lookup is independent of that bound.

## Regression coverage

[`packages/backend/tests/disputes/c14.response.test.ts`](../../packages/backend/tests/disputes/c14.response.test.ts) contains 74 cases:

- 32 accepted combinations across both participant roles, both wallet types, micro-gig and milestone parents, and all four active statuses;
- 32 rejected combinations across the same dimensions and all four terminal statuses;
- one-event/one-opposite-notification attribution, attachment parent context, review-status preservation, and no conversation message;
- matching replay, conflicting message/wallet-type/attachment-order reuse, concurrent matching calls, different-key identical content, actor/case key isolation, and omitted-ID compatibility;
- invalid/blank/overlong request IDs, unrelated/reassigned/mismatched parents, terminal status, blank messages, invalid attachments, and complete snapshots including timestamps and access logs;
- out-of-order/tied timeline events, case isolation, the 200-event boundary, and keyed replay of an event outside that timeline window.

Schema and public-contract additions are covered by [`schema.contract.test.ts`](../../packages/backend/tests/disputes/schema.contract.test.ts), [`index.contract.test.ts`](../../packages/backend/tests/disputes/index.contract.test.ts), and [`api.contract.test.ts`](../../packages/backend/tests/disputes/api.contract.test.ts).

## Validation results

All commands were run locally on 2026-10-14 in the repository checkout:

| Check | Result |
| --- | --- |
| `pnpm --filter @repo/backend exec vitest run tests/disputes/c14.response.test.ts` | 74 passed |
| `pnpm --filter @repo/backend test` | 456 passed across 15 files |
| `pnpm --filter @repo/backend exec tsc --project convex/tsconfig.json --noEmit` | passed |
| `pnpm --filter @repo/backend exec tsc --project tests/tsconfig.json --noEmit` | passed |
| scoped `oxlint` on changed backend source/tests | passed |
| scoped `oxfmt --check` on changed backend source/tests | passed |
| `git diff --check` | passed |

The test runner emitted existing Vite CommonJS/native-loader and Node localStorage experimental warnings; they did not fail a test or check.

## Boundaries

This is local `convex-test` and TypeScript evidence. It does not prove caller-supplied wallet possession, live Convex deployment behavior, storage service behavior, Stellar RPC, transaction signing/submission, Soroban contract behavior, or notification delivery. C16 must generate one request ID per logical response and retain it across retries. Calls omitting `requestId` intentionally remain non-idempotent. No deployment, migration, external service write, frontend change, or generated-file edit was performed.
