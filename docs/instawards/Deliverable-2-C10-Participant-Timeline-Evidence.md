# Deliverable 2 C10 - Participant Timeline Regression Evidence

This note records mocked local UI evidence for C10. Source code, generated Convex types, and current test results are authoritative.

## Acceptance map

| Acceptance criterion | Evidence |
| --- | --- |
| Timeline fixtures cover every event type and actor role | `dispute-timeline.test.tsx` builds `TParticipantDisputeTimelineQueryResult` fixtures for all 14 event types and all four actor roles. It covers an old/new status transition, a new-status-only event, event attachments, and transaction links. |
| Wallet and dispute changes replace timeline state | The timeline fixture map is keyed by Convex function and serialized arguments. The test changes wallet and dispute IDs after an error and asserts that the new events replace the prior case without retaining the raw error. |
| Repeated timeline failures remain recoverable | The timeline test retries a failing read repeatedly, keeps the accessible failure alert and retry button, hides the backend error text, and recovers to events when the keyed fixture succeeds. |
| Timeline loading/failure does not remove participant detail or drafts | `dispute-participant-integration.test.tsx` renders the real `DisputeDetailPanel`, participant action composers, and `ParticipantDisputeTimeline`. Both a loading read and a failed read leave the case heading, evidence draft, response draft, and attachment draft intact. |
| Timeline retry is read-only | The integration test retries the real timeline and asserts that participant mutations and mocked Stellar operations have no calls. |
| Revocation and disconnect remove the real timeline | The integration test changes the permission fixture to denied, then disconnects the wallet, and asserts that the real timeline and prior event are absent. Restored access uses the current freelancer wallet and a new dispute ID in permission, detail, response-permission, and timeline query arguments. |
| Accessible states remain covered | Existing production UI and tests provide the loading `role="status"`, failure `role="alert"`, named `Retry timeline` button, and named `Dispute evidence timeline` list. C04 route/list/status coverage remains the acceptance evidence for those areas; C10 does not duplicate it. |

## Validation

Commands run from the repository root:

```text
pnpm --filter web test features/disputes
```

Pass: 54 tests across 9 files.

```text
pnpm --filter web exec tsc --noEmit
pnpm exec oxlint apps/web/features/disputes/components/dispute-timeline.test.tsx apps/web/features/disputes/components/dispute-participant-integration.test.tsx
pnpm exec oxfmt --check apps/web/features/disputes/components/dispute-timeline.test.tsx apps/web/features/disputes/components/dispute-participant-integration.test.tsx
```

All checks passed. Scoped oxlint reported 0 warnings and 0 errors; scoped oxfmt reported that both files use the correct format.

## Boundaries

Only regression tests and acceptance documentation changed. Public APIs, generated types, schemas, status vocabulary, query limits, Convex subscriptions, and production error boundaries were not changed. The participant wallet argument remains an application scope value and does not prove wallet possession. No contract, transaction recovery, deployment, live-chain, or live Convex verification was performed.
