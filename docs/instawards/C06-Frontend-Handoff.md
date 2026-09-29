---
type: handoff
area: frontend
status: frozen
last_updated: 2026-09-28
source_of_truth: repository
---

# C06 Frontend Handoff

This document freezes the shared dispute UI boundary after C06. Source code, generated Convex types, and tests remain authoritative if this document becomes stale.

## Shared imports

- `@/features/disputes/types`: Convex-derived dispute field types and named participant query-result/argument types.
- `@/features/disputes/lib`: reason/status labels, filter options, terminal classification, status guards, and date formatting.
- `@/features/disputes`: participant component barrel plus the shared `lib` and type exports.
- `@/features/admin/types`: generated admin query-result view models and admin HTTP request types.
- `@/features/admin/lib/admin-api`: admin HTTP client, `AdminApiError`, access/not-found/network classification, typed filters, and retry policy.
- `@repo/convex-client`: generated `api`, `TConvexDoc`, and `TConvexId`.

The shared status contract has eight dispute statuses: `open`, `under_review`, `awaiting_client_response`, `awaiting_freelancer_response`, `resolved_client`, `resolved_freelancer`, `split_resolution`, and `cancelled`. The four on-chain marking phases are `not_marked`, `marking`, `marked`, and `mark_failed`. `TERMINAL_DISPUTE_STATUSES` and `isTerminalDisputeStatus` classify the four terminal dispute states: both resolved outcomes, split resolution, and cancelled.

## View-model shapes and nullability

Participant code should consume the named types in `features/disputes/types.ts` instead of recreating unions or document shapes:

| Export | Generated source | Shape / state |
| --- | --- | --- |
| `TParticipantDisputeListQueryResult` | `api.disputes.getDisputesForWallet` | `disputes[]`; generated `disputes` documents, no attachment URLs |
| `TParticipantDisputeQueryResult` | `api.disputes.getDispute` | dispute with `attachments[]`, or `null` when the ID is missing; protected reads can also fail with a Convex authorization error |
| `TParticipantDisputeByParentQueryResult` | `api.disputes.getDisputeByParent` | active dispute with `attachments[]`, or `null` when no visible active dispute exists |
| `TParticipantActiveDisputeForEscrowQueryResult` | `api.disputes.getActiveDisputeForEscrow` | active dispute with `attachments[]`, or `null` when no active dispute exists |
| `TParticipantDisputeTimelineQueryResult` | `api.disputes.getDisputeTimeline` | ordered event array with serialized `attachments[]`; missing dispute returns `[]`, unauthorized access throws |
| `TParticipantDisputeEvidenceQueryResult` | `api.disputes.getDisputeEvidence` | serialized attachment array; missing dispute returns `[]` |
| `TParticipantDisputeContextQueryResult` | `api.disputes.getDisputeContextByParent` | parent plus submissions, revisions, and deadline events, or `null` for a viewer outside the parent participants |
| `TParticipantAgreementContextQueryResult` | `api.work_agreements.getAgreementContextForDispute` | agreement/version context or `null` when no agreement context exists; unauthorized parent access throws |
| `TParticipantLatestSubmissionQueryResult` | `api.work_submissions.getLatestSubmissionForEscrow` | latest visible submission or `null`; unavailable/missing escrow errors remain Convex errors |
| `TParticipantRevisionRequestsQueryResult` | `api.revisions.getRevisionRequestsByParent` | visible revision-request array; inaccessible attachment-bearing revisions are omitted |
| `TParticipantDisputeEligibilityQueryResult` | `api.disputes.canOpenDispute` | `{ allowed, reason, openedByRole, escrowId, onChainEscrowId }`; denied fields are `null` |
| `TParticipantDisputePermissionQueryResult` | `api.disputes.canViewDispute` | `{ allowed, reason, role? }`; denied access uses `false`, a message, and `role: null`; a missing dispute omits `role` |
| `TParticipantDisputeResponsePermissionQueryResult` | `api.disputes.canRespondToDispute` | `{ allowed, reason, role }`; denied/missing cases use `false`, a message, and `role: null` |

`TDisputeStatus`, `TDisputeOnChainStatus`, `TDisputeReasonCategory`, `TDisputeParentType`, `TDisputeActorRole`, and `TDisputeActorWalletType` are derived from `TConvexDoc<...>` fields. Document fields that are optional in the generated model must remain nullable/optional in UI code, notably parent IDs (`jobId`, `microGigId`, `milestoneId`, `escrowId`), on-chain identifiers, wallet-type fields, related message/deadline IDs, agreement/proof fields, transaction and resolution fields, and arbitrary `metadata`. Attachments expose `url: string | null`; a missing URL is not a failed attachment query.

Admin view models are derived from the generated admin query results:

- `TAdminDisputeQueueQueryResult` / `IAdminDisputeListItem` comes from `api.admin.listAdminDisputes` and contains `disputeId`, number/title, status, on-chain status, reason, both participant wallets, and opened/updated timestamps.
- `TAdminDisputeDetailQueryResult` / `IAdminDisputeDetail` comes from `api.admin.getAdminDispute` and contains `dispute`, `timeline`, and nullable `job`, `milestone`, and `escrow` parent records. The dispute and timeline attachment arrays may contain nullable storage URLs.
- `IAdminDisputesResponse` remains the HTTP envelope `{ disputes: TAdminDisputeQueueQueryResult }`; `IAdminDashboardMetrics` remains the generated metrics result envelope.

Current limits are intentionally bounded: the participant wallet query reads up to 50 client matches plus 50 freelancer matches before deduplication; parent dispute lookup takes 20; participant timelines take 200 events; participant context takes up to 50 submissions, 50 revisions, and 50 deadline events. The admin queue UI requests 120 rows; the server clamps admin queue requests to 1–200. Admin detail takes 300 timeline events and resolves the evidence IDs stored on the dispute. Admin metrics scan each bounded source up to 2,000 records and returns 12 recent disputes.

## Convex functions consumed by participant UI

The following names and argument contracts are frozen from the generated API and current backend validators. `Id<"...">` means `TConvexId<"...">`; wallet strings are normalized and checked by backend helpers.

### Reads and eligibility

| Function | Arguments |
| --- | --- |
| `api.disputes.getDisputesForWallet` | `{ walletAddress: string }` |
| `api.disputes.getDispute` | `{ disputeId: Id<"disputes">, viewerWallet?: string }` |
| `api.disputes.getDisputeTimeline` | `{ disputeId: Id<"disputes">, viewerWallet?: string }` |
| `api.disputes.getDisputeEvidence` | `{ disputeId: Id<"disputes">, viewerWallet?: string }` |
| `api.disputes.getDisputeByParent` | `{ parentType: TDisputeParentType, parentId: string, viewerWallet?: string }` |
| `api.disputes.getActiveDisputeForEscrow` | `{ escrowId: Id<"escrows">, viewerWallet?: string }` |
| `api.disputes.getDisputeContextByParent` | `{ parentType: TDisputeParentType, parentId: string, viewerWallet?: string }` |
| `api.disputes.canOpenDispute` | `{ parentType: TDisputeParentType, parentId: string, openedByWallet: string }` |
| `api.disputes.canViewDispute` | `{ disputeId: Id<"disputes">, viewerWallet: string }` |
| `api.disputes.canRespondToDispute` | `{ disputeId: Id<"disputes">, walletAddress: string }` |
| `api.work_agreements.getAgreementContextForDispute` | `{ disputeId: Id<"disputes">, viewerWallet: string }` |
| `api.work_submissions.getLatestSubmissionForEscrow` | `{ onChainEscrowId: string, viewerWallet?: string }` |
| `api.revisions.getRevisionRequestsByParent` | `{ parentType: "milestone" | "micro_gig", parentId: string, viewerWallet?: string }` |

### Creation, evidence, responses, and marking phases

| Function | Arguments |
| --- | --- |
| `api.disputes.createDispute` | `{ parentType, parentId, openedByWallet, openedByWalletType, reasonCategory, title, description, evidenceAttachmentIds?, relatedWorkSubmissionIds?, relatedRevisionRequestIds?, relatedMessageIds?, relatedDeadlineEventIds?, proofHash?, escrowContractId?, metadata? }` |
| `api.disputes.addDisputeEvidence` | `{ disputeId, actorWallet, actorWalletType, attachmentIds, message? }` |
| `api.disputes.addDisputeResponse` | `{ disputeId, responderWallet, responderWalletType, message, attachmentIds? }` |
| `api.disputes.markDisputeOnChainStarted` | `{ disputeId, actorWallet, actorWalletType }` |
| `api.disputes.markDisputeOnChainSucceeded` | `{ disputeId, actorWallet, actorWalletType, transactionHash, stellarExpertUrl? }` |
| `api.disputes.markDisputeOnChainFailed` | `{ disputeId, actorWallet, actorWalletType, errorMessage, transactionHash? }` |

The precise typed aliases for these mutation arguments are `TParticipantCreateDisputeArgs`, `TParticipantAddDisputeEvidenceArgs`, `TParticipantAddDisputeResponseArgs`, and the three `TParticipantMarkDispute*Args` exports in `features/disputes/types.ts`.

## Admin HTTP boundary

Admin browser code does not call the admin Convex functions directly. It consumes these HTTP routes through `features/admin/lib/admin-api.ts`:

| Route | Method / contract | Read/write distinction |
| --- | --- | --- |
| `/api/admin/session` | `GET`, no body; `{ adminWallet: string }` | signed-session access check |
| `/api/admin/metrics` | `GET`, no body; `IAdminDashboardMetrics` | bounded read |
| `/api/admin/disputes` | `GET`; query `status?: TDisputeStatus`, `onChainStatus?: TDisputeOnChainStatus`, `limit?: number` (`1..200`); `{ disputes }` | bounded queue read |
| `/api/admin/disputes/[disputeId]` | `GET`; route ID `1..128` chars matching `[A-Za-z0-9_-]+`; `IAdminDisputeDetail` | detail read; Convex `NOT_FOUND` maps to HTTP 404 |
| `/api/admin/disputes/[disputeId]/status` | `POST`; `{ status: TAdminReviewStatus, message?: string }` | review write |
| `/api/admin/disputes/[disputeId]/note` | `POST`; `{ message: string }` | note write |
| `/api/admin/disputes/[disputeId]/resolve` | `POST`; `{ phase: "started" | "succeeded" | "failed", status: TAdminResolutionStatus, freelancerShareBps: number, ... }`; succeeded requires `transactionHash`, failed requires `errorMessage` | settlement bookkeeping write |

`AdminApiError` is intentionally separate from participant Convex errors. Both surfaces present loading, empty, invalid/not-found, forbidden, and failed-read states with the existing route callout/empty-state components, but their authorization boundaries and retry policies remain distinct. Network and 5xx admin reads are normalized as retryable admin errors; 400, 401, 403, and 404 are not automatically retried.

## UI-state matrix

| State | Participant surface | Admin queue/detail surface |
| --- | --- | --- |
| Wallet disconnected | Do not call identity-scoped reads; show connect-wallet guidance | Do not mount protected queue/detail content; show connect-admin-wallet guidance |
| Wallet connecting / wrong mode | Keep participant reads skipped until an active wallet exists | Keep content unmounted; require the connected external admin wallet, not passkey mode |
| Authentication pending | Participant Convex reads may be wallet-scoped, but are not signed-session proof | `/api/admin/session` is pending; protected content remains unmounted |
| Authentication required (401) | Convex/query error presentation remains participant-scoped | Remove protected content, clear protected cache, offer wallet authentication |
| Forbidden (403) | Backend participant helper result/error is shown; browser guard is not the authorization boundary | Remove protected content and show forbidden/retry access state |
| Read loading | Accessible loading fallback; no empty/zero-count conclusion | Existing admin loading fallback; no workload metrics before queue data exists |
| Empty | Explicit empty list or empty timeline; not a failed read | Explicit empty queue or empty timeline; not a failed read |
| Invalid request (400) | Show validation/error message from Convex flow | Show invalid request and keep it distinct from not-found and retryable failures |
| Not found (404 / null) | `null` dispute is not found or inaccessible; preserve backend wording | Detail maps `NOT_FOUND` to 404 and offers return to queue; no automatic retry |
| Failed read | Keep the error visible; offer a data-read retry where the component supports it | Keep error visible; network/5xx reads may retry, and explicit Retry refetches the data read |
| Marking failure | Show `mark_failed` / retry-required state and the recorded failure message | The retry button starts a new `mark_disputed` chain operation and then refreshes the data read |
| Resolved/read-only | Render terminal status and timeline/evidence without write controls | Hide review/settlement controls for terminal statuses; keep timeline and transaction links readable |

Retrying a data read means refetching the same Convex/API query. Retrying a chain operation means constructing/signing/submitting a new Stellar operation and separately recording its phase. A `mark_failed` label alone does not establish transaction retry safety; the existing retry path uses a new client request ID and must continue to respect wallet/network readiness and transaction uncertainty handling. No C06 test submits a transaction or expands settlement behavior.

## Ownership and coordination

- Frontend Developer 1 owns `apps/web/app/admin/`, `apps/web/features/admin/`, and the shared dispute exports in `apps/web/features/disputes/types.ts` and `apps/web/features/disputes/lib.ts`, including formatting helpers, labels, classification helpers, and badges.
- Frontend Developer 2 owns `apps/web/app/disputes/`, participant components in `apps/web/features/disputes/components/`, and participant-facing tests. Developer 2 consumes the frozen exports and does not edit the administrator route/feature files as part of the participant work.
- Backend and Stellar helpers retain their existing ownership in `packages/backend/convex/` and `apps/web/core/stellar/`.
- Any shared-contract change requires coordination with Frontend Developer 1, an update to this handoff, and focused regression coverage before participant work consumes it.

Current participant authentication limitation: participant Convex reads and mutations still receive caller-supplied wallet values and rely on backend participant/eligibility helpers for comparison. The browser wallet identity and UI guard are not equivalent to signed-session possession proof. C06 preserves this limitation and does not claim that participant flows have admin-style signed-session authentication.
