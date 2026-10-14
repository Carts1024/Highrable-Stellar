---
title: Deliverable 3 C07 — Protected Administrator Case Visibility Evidence
type: evidence
area: frontend-admin
status: current
last_updated: 2026-10-13
source_of_truth: repository source and local tests
---

# Deliverable 3 C07 — Protected Administrator Case Visibility

## Scope

C07 verifies that newly opened client micro-gig and freelancer milestone cases enter the protected administrator queue and open the matching detail record. The work stays on `instawards/dev/bette` and is limited to administrator-owned frontend/API-consumer files and tests. No push, deployment, external transaction, participant-file change, public API signature, schema, generated type, wallet execution, or contract change was made.

## Implementation evidence

- Added generated-type-backed integration fixtures for client-opened micro-gig and freelancer-opened milestone cases in initial `open` / `not_marked` state, with canonical participants, parent references, opening events, nullable/available parent records, and unassigned cases.
- Extended `admin-protected-pages.integration.test.tsx` through the real `AdminSessionGate`, protected HTTP client, and TanStack Query cache. Queue links preserve each dispute identity for detail navigation under both active dispute-admin and owner sessions. Newly opened unmarked cases keep settlement disabled, and the read journey issues GET requests only.
- Added a pre-cache `fetchAdminDispute` consistency guard. It rejects a wrong case ID, contradictory declared parent references, mismatched returned job/milestone/escrow IDs, and conflicting linked relationships with the generic `Admin API returned an inconsistent dispute detail.` message. Optional references and nullable parent records remain acceptable when no contradictory value is supplied. The 409 consistency error is not automatically retryable; the detail page offers only a queue return link and manual read retry, without case content or actions.
- Expanded the case brief with opener role/wallet, canonical parent type/reference, job and milestone titles, and explicit unavailable linked-record labels. Existing authorization, review eligibility, settlement, session-gate, cache-eviction, and Stellar guards remain in place.

## Validation results

Executed locally on 2026-10-13 from `instawards/dev/bette`:

| Command | Result |
| --- | --- |
| `pnpm --filter web test features/admin` | PASS — 8 files, 247 tests. |
| `pnpm --filter web exec tsc --noEmit` | PASS. |
| Scoped `oxlint` on the four changed frontend files | PASS — 0 warnings, 0 errors. |
| Scoped `oxfmt --check` on the four changed frontend files | PASS. |
| `pnpm --filter web test` | 26 of 27 files passed; 421 of 423 tests passed. The two failures are the existing participant assertions in `features/disputes/components/dispute-participant-integration.test.tsx` that still expect `Escrow dispute marking is confirmed on Stellar.` while the current UI renders `Outcome Pending` or `Recording Confirmation`. Participant files were not changed. |
| `pnpm --filter web build` | PASS — Next.js production build completed and generated the admin queue/detail routes. |

## Evidence limits

This is local frontend integration evidence using typed fixtures and mocked HTTP/session/wallet/chain seams. It does not prove participant creation, backend authorization, signed wallet possession, administrator capability enforcement in Convex, live RPC behavior, wallet signing, deployed contract compatibility, or live-chain behavior. Real Convex creation-to-admin-read coverage remains outside this selected C07 scope; frontend consistency checks supplement trusted backend authorization.
