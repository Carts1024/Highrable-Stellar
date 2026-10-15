---
type: handoff
area: backend
status: verified
last_updated: 2026-10-14
source_of_truth: repository
---

# Deliverable 2 C02 Backend Contract Handoff

This handoff records the Deliverable 2 C02 compatibility boundary for the Convex dispute API. It extends the existing in-memory harness with source-verified schema, index, generated-API, validator, and participant-result-shape coverage. Deliverable 3 C14 adds the response-specific optional request ID and dedicated replay index documented below; all other C02 contracts remain unchanged.

This is distinct from Deliverable 1 C02. Deliverable 1 C02 established the initial `disputes`/`disputeEvents` schema and index contract plus the backend fixture foundation. Deliverable 2 C02 preserves that harness and closes compatibility gaps at the accepted vocabulary, assigned-admin index, public export, malformed-argument, rejected-write, and query-shape boundaries.

## Source map

- Schema: [`packages/backend/convex/disputes/schema.ts`](../../packages/backend/convex/disputes/schema.ts)
- Public dispute exports: [`packages/backend/convex/disputes.ts`](../../packages/backend/convex/disputes.ts)
- Public dispute arguments and handlers: [`packages/backend/convex/disputes/mutations.ts`](../../packages/backend/convex/disputes/mutations.ts), [`queries.ts`](../../packages/backend/convex/disputes/queries.ts)
- Working administrator boundary: [`packages/backend/convex/admin.ts`](../../packages/backend/convex/admin.ts), [`admin/mutations.ts`](../../packages/backend/convex/admin/mutations.ts), [`admin/queries.ts`](../../packages/backend/convex/admin/queries.ts)
- Participant consumer aliases: [`apps/web/features/disputes/types.ts`](../../apps/web/features/disputes/types.ts)
- C02 tests: [`schema.contract.test.ts`](../../packages/backend/tests/disputes/schema.contract.test.ts), [`index.contract.test.ts`](../../packages/backend/tests/disputes/index.contract.test.ts), [`api.contract.test.ts`](../../packages/backend/tests/disputes/api.contract.test.ts)

## Schema vocabulary

| Contract | Accepted values covered by C02 |
| --- | --- |
| `disputes.parentType` | `micro_gig`, `milestone`, `escrow`, `job` |
| `disputes.reasonCategory` | `work_not_delivered`, `work_quality_issue`, `client_unresponsive`, `freelancer_unresponsive`, `missed_deadline`, `revision_disagreement`, `payment_release_disagreement`, `scope_disagreement`, `other` |
| `disputes.status` | `open`, `under_review`, `awaiting_client_response`, `awaiting_freelancer_response`, `resolved_client`, `resolved_freelancer`, `split_resolution`, `cancelled` |
| `disputes.onChainStatus` | `not_marked`, `marking`, `marked`, `mark_failed` |
| Wallet fields | `external_wallet`, `passkey_smart_account`; event actor wallet type also accepts `system` |
| `disputeEvents.actorRole` | `client`, `freelancer`, `moderator`, `system` |
| `disputeEvents.type` | `dispute_opened`, `evidence_added`, `on_chain_mark_started`, `on_chain_mark_succeeded`, `on_chain_mark_failed`, `status_changed`, `client_response_added`, `freelancer_response_added`, `moderator_note_added`, `resolution_proposed`, `resolved_client`, `resolved_freelancer`, `split_resolution`, `cancelled` |
| Event status fields | `oldStatus` and `newStatus` are independently optional; each uses the dispute status vocabulary |

C02 also rejects unknown enum members, incorrect scalar/array types, and IDs encoded for another Convex table. These are schema/API boundary checks; domain relationship matrices remain in the existing C05 and C09 suites.

## Index contract

The dispute indexes and field order are:

| Table | Index | Fields |
| --- | --- | --- |
| `disputes` | `by_disputeNumber` | `disputeNumber` |
| `disputes` | `by_parent_status` | `parentType`, `parentId`, `status` |
| `disputes` | `by_escrow_status` | `escrowId`, `status` |
| `disputes` | `by_onChainEscrow_status` | `onChainEscrowId`, `status` |
| `disputes` | `by_milestone_status` | `milestoneId`, `status` |
| `disputes` | `by_client` | `clientWallet`, `updatedAt` |
| `disputes` | `by_freelancer` | `freelancerWallet`, `updatedAt` |
| `disputes` | `by_assignedAdmin_updatedAt` | `assignedAdminWallet`, `updatedAt` |
| `disputes` | `by_status` | `status`, `updatedAt` |
| `disputeEvents` | `by_dispute` | `disputeId`, `createdAt` |
| `disputeEvents` | `by_dispute_actor_requestId` | `disputeId`, `actorWallet`, `requestId` |
| `disputeEvents` | `by_type` | `type`, `createdAt` |

The assigned-admin test seeds three timestamps for one administrator and a separate administrator, then proves compound-index descending order and administrator isolation.

## Public dispute API

The generated `api.disputes.*` references are the compatibility surface. C02 references all 20 public exports so a missing or renamed export is caught by the test project’s generated API types.

### Participant reads and permission results

| Function | Arguments | Result contract |
| --- | --- | --- |
| `getDispute` | `{ disputeId, viewerWallet? }` | Dispute plus `attachments[]`, or `null` when missing; unauthorized participant access rejects |
| `getDisputeByParent` | `{ parentType, parentId, viewerWallet? }` | Visible active dispute plus `attachments[]`, or `null` |
| `getActiveDisputeForEscrow` | `{ escrowId, viewerWallet? }` | Visible active dispute plus `attachments[]`, or `null` |
| `getDisputesForWallet` | `{ walletAddress }` | Array of dispute documents; unrelated wallet is `[]` |
| `getDisputeTimeline` | `{ disputeId, viewerWallet? }` | Ordered event array; each event has `attachments[]`; missing is `[]`, unauthorized access rejects |
| `getDisputeEvidence` | `{ disputeId, viewerWallet? }` | Serialized attachment array; missing is `[]`, unauthorized access rejects |
| `getDisputeContextByParent` | `{ parentType, parentId, viewerWallet? }` | Parent context with `submissions[]`, `revisions[]`, and `deadlineEvents[]`; an outside participant gets `null` |
| `canOpenDispute` | `{ parentType, parentId, openedByWallet }` | `{ allowed, reason, openedByRole, escrowId, onChainEscrowId }`; denied fields are `null` |
| `canViewDispute` | `{ disputeId, viewerWallet }` | Allowed participant: `{ allowed: true, reason: null, role }`; denied: `role: null`; missing dispute omits `role` |
| `canRespondToDispute` | `{ disputeId, walletAddress }` | `{ allowed, reason, role }`; denied and missing cases use `role: null` |

The omitted-versus-null `canViewDispute.role` distinction is intentional and is locked by `api.contract.test.ts`. The named frontend aliases and nullability in [`C06-Frontend-Handoff.md`](C06-Frontend-Handoff.md) remain aligned with these results.

### Participant mutations

| Function | Public arguments | Result boundary |
| --- | --- | --- |
| `createDispute` | `{ parentType, parentId, openedByWallet, openedByWalletType, reasonCategory, title, description, evidenceAttachmentIds?, relatedWorkSubmissionIds?, relatedRevisionRequestIds?, relatedMessageIds?, relatedDeadlineEventIds?, proofHash?, escrowContractId?, metadata? }` | Runtime return validator: `v.id("disputes")` |
| `markDisputeOnChainStarted` | `{ disputeId, actorWallet, actorWalletType }` | Runtime return validator: `v.boolean()` |
| `markDisputeOnChainSucceeded` | `{ disputeId, actorWallet, actorWalletType, transactionHash, stellarExpertUrl? }` | Runtime return validator: `v.boolean()` |
| `markDisputeOnChainFailed` | `{ disputeId, actorWallet, actorWalletType, errorMessage, transactionHash? }` | Runtime return validator: `v.boolean()` |
| `addDisputeEvidence` | `{ disputeId, actorWallet, actorWalletType, attachmentIds, message? }` | Result is TypeScript-inferred; current successful handler result is `true` |
| `addDisputeResponse` | `{ disputeId, responderWallet, responderWalletType, message, attachmentIds?, requestId? }` | Result is TypeScript-inferred; current successful handler result is `true` |
| `changeDisputeStatus` | `{ disputeId, actorWallet, actorWalletType, status, message? }` | Result is TypeScript-inferred; current successful handler result is `true` |
| `cancelDispute` | `{ disputeId, actorWallet, actorWalletType, message? }` | Result is TypeScript-inferred; current successful handler result is `true` |

`addModeratorNote` and `recordDisputeResolution` remain public compatibility placeholders under `api.disputes`. Their argument names are preserved, but their handlers reject with the documented future-phase errors and have no successful result contract. They are not aliases for the working administrator functions.

### Deliverable 3 C14 response extension

`addDisputeResponse` accepts an optional `requestId`, trims it, rejects blank values and values longer than 128 characters, and continues to return `true`. When supplied, the sanitized ID is stored only on the response audit event. Existing events remain valid without it; no backfill is required.

After current parent/participant authorization, active-status, message, and attachment validation, a keyed response lookup uses `by_dispute_actor_requestId`. A matching saved response compares the sanitized message, responder wallet type, and first-seen deduplicated attachment IDs in saved order, then returns `true` without writes. Reusing a key with different content rejects atomically. New keyed responses preserve the existing evidence update, response event, opposite-participant notification, review status, and no-conversation-message behavior. The existing `by_dispute` ascending timeline index and 200-event bound are unchanged, so replay lookup also works for events outside the timeline window.

C16 must generate one request ID per logical participant response and retain it across retries. Calls that omit `requestId` remain legacy non-idempotent calls: retrying them can create another response event and notification. The request ID is an application replay key only and does not prove possession of the caller-supplied wallet.

## Working administrator APIs

Administrator operations use the trusted server boundary: the browser establishes a signed external-wallet session through the admin routes, and Convex independently checks the configured secret plus the owner or active scoped dispute-admin capability. The working Convex functions are under `api.admin`, including:

- `addModeratorNote` and `changeDisputeReviewStatus` for assigned-admin review;
- `claimDispute` and `assignDispute` for assignment;
- `recordDisputeResolutionStarted`, `recordDisputeResolutionSigned`, `recordDisputeResolutionSubmissionUnknown`, `recordDisputeResolutionSucceeded`, and `recordDisputeResolutionFailed` for settlement bookkeeping;
- membership, capability, queue/detail, operation, and settlement-attempt queries/mutations in [`admin.ts`](../../packages/backend/convex/admin.ts) and its domain modules.

The settlement functions with runtime return validators are `recordDisputeResolutionStarted` (`operationId`, `freelancerShareBps`), `recordDisputeResolutionSigned` (`operationId`, `transactionHash`), `recordDisputeResolutionSubmissionUnknown` (`status`), `recordDisputeResolutionSucceeded` (terminal status, bps, payout/refund, resolution hash and explorer URL), and `recordDisputeResolutionFailed` (`boolean`). Other administrator results are inferred from their handlers. The existing C17/C21 suites remain the behavioral evidence for settlement terms, callbacks, replay, and rollback.

## Identity and chain boundaries

- Participant dispute reads and mutations still receive caller-supplied wallet values. Backend participant/role comparisons reject unrelated wallets, but these arguments do not prove private-key possession or signed-session identity.
- Administrator operations are checked at the trusted server boundary through signed-session authentication plus independent Convex secret/capability checks. A test-only configured wallet and secret are used in the in-memory harness; they are not production credentials.
- The C02 tests run against an in-memory Convex database with a deterministic clock and the real composed schema/module map. They do not execute Stellar RPC, sign or submit transactions, verify deployed contract IDs, consume Soroban events, or prove chain execution. Marking and settlement tests verify local callback/bookkeeping contracts only.

## Evidence and validation

The new coverage deliberately reuses existing behavioral evidence:

- C05: parent, participant, authorization, eligibility, duplicate, and rejected-creation behavior;
- C09: creation, related-record, evidence association, and atomic rollback matrices;
- C13/C21: marking callbacks, retries, reconciliation, and side effects;
- C17/C21: administrator settlement callbacks, terminal mappings, uncertainty, and rollback;
- C19: participant evidence and response behavior.

Deliverable 2 C02 additions:

- focused schema/index/API run: 59 tests passed across 3 files;
- full backend run: 154 tests passed across 10 files;
- backend source type-check: `pnpm --filter @repo/backend exec tsc --project convex/tsconfig.json --noEmit`;
- backend test type-check: `pnpm --filter @repo/backend exec tsc --project tests/tsconfig.json --noEmit`;
- formatting: `pnpm exec oxfmt --write` on the three changed test files.

Deliverable 3 C14 additions:

- focused response suite: `pnpm --filter @repo/backend exec vitest run tests/disputes/c14.response.test.ts` — 74 tests passed;
- full backend suite: `pnpm --filter @repo/backend test` — 456 tests passed across 15 files;
- backend source and test TypeScript checks passed;
- scoped oxlint, scoped oxfmt check, and `git diff --check` passed;
- evidence report: [`Deliverable-3-C14-Participant-Response-Evidence.md`](Deliverable-3-C14-Participant-Response-Evidence.md).

No deployment, migration, live transaction, generated-file edit, frontend implementation, contract, dependency, or environment change is part of C14.
