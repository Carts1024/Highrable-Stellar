---
type: evidence
area: backend
status: verified-local
last_updated: 2026-10-15
source_of_truth: repository
---

# Deliverable 3 C22 — Participant Backend Acceptance Evidence

## Scope

C22 adds deterministic `convex-test` acceptance coverage around the connected participant journey and the boundaries that are easiest to miss when each function is tested in isolation:

- create a dispute, add participant-owned evidence, respond, and read the resulting history;
- reauthorize reads and writes after participant reassignment, parent deletion, or conflicting saved links;
- isolate wallets, independent cases, micro-gigs, milestones, sibling milestones, attachments, and related records;
- prove mixed valid/foreign/revoked evidence and response requests reject without changing the complete document graph;
- preserve readable terminal history while rejecting new evidence, new responses, keyed-response replays, and active-case lookups.

The new suite uses the generated `api`, the existing `convex-test` harness, parent fixtures, `seedSiblingMilestoneFixture`, and `snapshotDisputeCreationState`. It adds no public API, schema, status, index, migration, frontend, contract, deployment, environment, or generated-file change.

## Acceptance mapping

[`packages/backend/tests/disputes/c22.participant-acceptance.test.ts`](../../packages/backend/tests/disputes/c22.participant-acceptance.test.ts) contains 18 cases:

| Acceptance requirement | C22 coverage | Result |
| --- | --- | --- |
| Authorized client/freelancer journeys | Eight connected cases cover all four active review statuses, both micro-gig/milestone parent kinds, both participant roles, and both `external_wallet`/`passkey_smart_account` bookkeeping values. They create the case, add owned evidence, respond, read detail/evidence/timeline, and assert exact event actor/role/wallet-type, notification recipient, and attachment association. | Passed |
| Exhaustive active/terminal response matrix | Existing C14 coverage remains authoritative for all role × wallet-type × parent × active/terminal status combinations. C22 adds the connected journey and terminal replay checks without duplicating that complete matrix. | C14: 74 passed; C22: passed |
| Revocation and stale requests | Three cases arrange participant reassignment, deleted parent, and conflicting saved parent link. Each repeats detail, parent, escrow, wallet-list, timeline, evidence, permission, policy, preview/download, attachment list/detail/multi-read/protection/access-log calls, then rejects stale evidence and response writes. | Passed |
| Wallet/case isolation | Two independent disputes alternate client/freelancer writes and wallet-type metadata, then assert each participant sees only the supplied case’s evidence and timeline. Unrelated wallets are denied and parent lookups return the requested case. | Passed |
| Parent isolation | Separate micro-gigs, micro-gig versus milestone, and sibling milestones sharing a job and participants reject cross-case attachments and a cross-parent work-submission reference. Successful main-milestone writes and rejected sibling writes leave the sibling case snapshot unchanged. | Passed |
| Atomic rejection | Foreign evidence and revoked response attachments are mixed with valid attachments. After the invalid condition is arranged, complete before/after snapshots compare disputes, attachments, access logs, events, notifications, messages, agreements, versions, submissions, deadlines, jobs, milestones, escrows, and parent-linked records. | Passed |
| Terminal history | `resolved_client`, `resolved_freelancer`, `split_resolution`, and `cancelled` retain participant detail/evidence/timeline history, exclude parent/escrow active lookups, reject evidence and new responses, reject a previously accepted keyed-response replay, and deny reads after later participant reassignment. | Passed |

## Regression correction

C22 demonstrated that `attachments.getAttachmentAccessLogs` could return logs to a former dispute-attachment owner after the dispute’s current parent/participant authorization had been revoked. Other protected attachment reads already failed closed. The smallest correction was to reject with the query’s existing `NotFoundError("Attachment not found.")` shape whenever the resolved attachment policy has `canView === false`, before the owner/admin/client log shortcut. No public arguments, schemas, statuses, indexes, or response shapes changed.

## Validation results

Commands were run locally on 2026-10-15 in the repository checkout:

| Check | Result |
| --- | --- |
| `pnpm --filter @repo/backend exec vitest run tests/disputes/c22.participant-acceptance.test.ts` | 18 passed |
| `pnpm --filter @repo/backend test` | 497 passed across 17 files |
| `pnpm exec tsc --project packages/backend/convex/tsconfig.json --noEmit` | passed |
| `pnpm exec tsc --project packages/backend/tests/tsconfig.json --noEmit` | passed |
| `pnpm exec oxlint packages/backend/convex/attachments/queries.ts packages/backend/tests/disputes/c22.participant-acceptance.test.ts` | passed |
| `pnpm exec oxfmt --write packages/backend/convex/attachments/queries.ts packages/backend/tests/disputes/c22.participant-acceptance.test.ts` | passed; applied repository formatting |
| `pnpm exec oxfmt --check packages/backend/convex/attachments/queries.ts packages/backend/tests/disputes/c22.participant-acceptance.test.ts` | passed |
| `git diff --check` | passed |

The runner emitted the existing Vite CommonJS/native-loader warning and Node localStorage experimental warning; neither affected results.

## Boundaries and limitations

This is local deterministic in-memory Convex evidence. It proves backend request isolation and reauthorization using caller-supplied wallet arguments, not cryptographic wallet possession or signed-session authentication. Stale-read coverage does not prove browser cache-race behavior. It does not prove live Convex deployment behavior, Convex storage availability, notification delivery, Stellar RPC, transaction signing/submission, Soroban contract behavior, Testnet deployment identity, or production data. No frontend, contract, deployment, external-service, environment, migration, or generated-file changes were made.
