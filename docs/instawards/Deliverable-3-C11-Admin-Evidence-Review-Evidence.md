---
title: Deliverable 3 C11 — Protected Administrator Evidence Review Evidence
type: evidence
area: frontend-admin
status: current
last_updated: 2026-10-14
source_of_truth: repository source and local tests
---

# Deliverable 3 C11 — Protected Administrator Evidence Review

## Scope and baseline gap

This report records local, mocked frontend/session/API evidence for Deliverable 3 C11. The prior administrator baseline passed 247 tests across 8 files. `AdminEvidenceList` already separated case evidence from timeline evidence and validated HTTP/HTTPS links, but all unavailable attachment conditions shared the generic `Evidence unavailable` label. The protected detail page also did not display the Convex-derived submission, revision, message, or deadline reference arrays.

No participant, backend, Convex schema/generated file, contract, wallet, deployment, environment, or mutation behavior changed.

## Implementation evidence

- `AdminEvidenceList` now presents `Available`, `Missing`, `Blocked`, `Deleted`, `Invalid`, and `URL unavailable` states. Missing means the referenced record was not returned and does not infer deletion. Returned blocked/deleted statuses are reflected directly. Malformed or unsafe URLs and unsupported statuses are invalid and never open. Active attachments without a URL explain that a detail refresh may recover it without promising recovery.
- Existing attachment metadata, stable reference order, first-seen deduplication, validated HTTP/HTTPS opening links, and descriptive `Open <name>` names remain intact. Case-level and timeline evidence continue to use separate renderer instances and data.
- The detail page now renders grouped, stable, deduplicated reference-only sections for submissions, revisions, messages, and deadlines. Each ID displays `Content unavailable in this view.` Optional message/deadline arrays are treated as empty. The UI does not fetch or invent linked content, deletion states, or destination links.
- The existing protected detail refresh remains the recovery path: it reports pending state, prevents duplicate requests, replaces the detail response on success, performs no write or Stellar calls, hides protected detail after denied/failed reads, and retains read-only retry for network/5xx failures. Existing wallet-scoped query/session eviction and late-response protections remain unchanged.
- Participant/case text is rendered as ordinary React content; the focused regression confirms markup-like participant text is escaped and does not create DOM elements.

## Regression matrix

`admin-dispute-detail-page.test.tsx` adds focused coverage for:

- every evidence presentation state, valid and unsafe URLs, missing opening URLs, unsupported statuses, omitted evidence, duplicate IDs, stable ordering, and descriptive links;
- independent case/timeline evidence rendering and preserved metadata;
- grouped/deduplicated submission, revision, message, and deadline IDs;
- omitted optional linked-record arrays, the empty linked-record state, reference-only rendering, and escaped participant text.

`admin-protected-pages.integration.test.tsx` retains and exercises the real protected session gate for owner and active dispute-admin access, initial denial, 401/403 refresh eviction, disconnect, wallet/case changes, late responses, read-only retries, GET-only refreshes, and no Stellar calls. The protected evidence integration fixture also verifies linked-reference visibility.

## Validation results

Executed locally on 2026-10-14 from the repository workspace:

| Command | Result |
| --- | --- |
| `pnpm --filter web test features/admin` | PASS — 8 files, 250 tests. |
| `pnpm --filter web exec tsc --noEmit` | PASS. |
| Scoped `pnpm --filter web exec oxlint ...` on the four changed administrator files | PASS — 0 warnings, 0 errors. |
| Scoped `pnpm --filter web exec oxfmt --check ...` on the four changed administrator files | PASS. |
| `pnpm --filter web test` | 26 of 27 files passed; 427 of 429 tests passed. The two failures are the historical participant integration assertions that still expect `Escrow dispute marking is confirmed on Stellar.` while current participant UI states are `Outcome Pending` / `Recording Confirmation`; no participant files changed. |
| `pnpm --filter web build` | PASS — Next.js 16.1.6 production build and static generation completed, including administrator routes. |

## Boundaries and limitations

This is local mocked UI/session/API evidence. It does not prove live storage availability, attachment authorization, backend administrator authorization, signed wallet possession, live Convex behavior, Stellar RPC behavior, deployed contract compatibility, Testnet execution, or live chain behavior. Linked submissions, revisions, messages, and deadlines remain reference-only; retrieving their content requires a separate protected-backend change.
