---
type: evidence
area: admin
status: current
last_updated: 2026-10-15
source_of_truth: repository
---

# C19 — Participant-to-administrator acceptance evidence

## Scope

This is local frontend acceptance coverage for participant dispute opening/evidence submission through protected administrator review and participant-visible status updates. The suite uses the real opening dialog, participant detail/actions, attachment uploader, evidence renderer, administrator queue/detail, review controls, badges, and timelines.

The harness uses mocked HTTP, Convex, upload, and Stellar transports. A typed test-local store derives its case, event, and attachment records from `@repo/convex-client`; accepted mocked mutations are the only operations that populate or update it. Administrator responses and wallet-scoped participant subscriptions are projected from that same store.

No production API, schema, contract, authentication, generated file, deployment, external-service, or transaction change was made.

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm --filter web exec vitest run features/admin/admin-cross-interface-acceptance.integration.test.tsx --maxWorkers=1 --minWorkers=1` | 7/7 tests passed |
| `pnpm --filter web exec vitest run features/admin --maxWorkers=1 --minWorkers=1` | 269/270 passed in the directory run; one existing protected-page journey was order-dependent and passed when rerun alone |
| `pnpm --filter web exec vitest run features/admin/admin-protected-pages.integration.test.tsx -t "accepts a protected review journey through authorization rejection and saved-transaction recovery" --maxWorkers=1 --minWorkers=1` | 1/1 passed |
| Participant opening/detail/evidence regressions plus `core/admin/server-auth.test.ts` | 45/45 tests passed across 6 files |
| `pnpm --filter web exec vitest run --maxWorkers=1 --minWorkers=1` | 450/450 tests passed across 29 files |
| `pnpm --filter web exec tsc --noEmit` | Passed |
| `pnpm exec oxlint apps/web/features/admin/admin-cross-interface-acceptance.integration.test.tsx` | 0 warnings, 0 errors |
| `pnpm exec oxfmt --check apps/web/features/admin/admin-cross-interface-acceptance.integration.test.tsx` | Passed |
| `pnpm --filter web build` | Production build passed |
| `git diff --check` | Passed |

The two previously documented participant assertions at lines 880 and 919 of `dispute-participant-integration.test.tsx` were rechecked and passed. They remain outside the C19 implementation scope.

## Scenario mapping

- Client-opened micro-gig and freelancer-opened milestone cases are created through the real opening dialog. Opening evidence is submitted through the real uploader, exact creation arguments are observed, the returned case ID is used, and a second isolated case prevents cross-case evidence leakage.
- Participant controls add follow-up evidence. The administrator case and event renderers verify matching attachment IDs, metadata, and safe links from the shared store.
- The administrator queue/detail flow is protected. The created case is claimed before an accepted `under_review` write. Parent, escrow, opener, client, freelancer, evidence, prior timeline, and status-change event identity are checked.
- Unauthorized 401 and 403 session responses prevent protected queue reads and content rendering.
- A 403 review write closes protected access, removes protected TanStack Query detail data, and leaves the canonical case, events, and participant subscriptions unchanged.
- An accepted `under_review` transition preserves the opening event and exposes the exact moderator wallet, external-wallet actor type, moderator role, message, old status, and new status to both participants.
- Rejected creation/evidence writes publish no case, attachment association, or evidence event while drafts remain retryable. Pending duplicate creation/evidence submissions issue one write and publish no accepted state before the deferred write resolves.
- The marking transport is a deterministic mock. Review actions are verified not to invoke marking mutations, signing, settlement, or the mocked Stellar transport.

## Authorization and transport limits

The 401/403 responses in this suite are mocked HTTP session/write responses and prove frontend protected-surface behavior only. They do not prove backend Convex authorization, signed-session cryptography, wallet possession, or live server enforcement. Existing backend authorization coverage is cited separately in the relevant Convex evidence and server-auth tests.

Upload completion, file storage, Convex subscriptions/mutations, administrator HTTP responses, and Stellar execution are mocked. This report does not establish live browser-to-Convex propagation, storage availability, Testnet state, deployed contract compatibility, real transaction settlement, audit/notification atomicity, or cross-tab durability.
