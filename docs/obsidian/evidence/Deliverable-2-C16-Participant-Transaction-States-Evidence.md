---
type: evidence
area: disputes
status: current
last_updated: 2026-10-07
source_of_truth: repository
---

# Deliverable 2 C16 — Participant Transaction States and Safe Retry

## Scope

This evidence covers the participant `mark_disputed` browser lifecycle in the opening dialog and participant detail retry flow. It is separate from the older C16 Soroban event-emission work. No public Convex arguments, schema, generated file, contract, environment, wallet executor, or confirmation semantics changed.

## Implementation evidence

- `apps/web/features/disputes/components/participant-marking.ts` centralizes the participant scope key, transaction-hash extraction, uncertainty classification, and original recording context.
- `open-dispute-dialog.tsx` holds one execution lock from dispute creation through marking and all recording mutations, retains the saved dispute after any marking/bookkeeping failure, and guards late completions and external-wallet signing.
- `dispute-detail-panel.tsx` uses the same generation and signed barrier, keeps the lock through confirmation recording, and retries only Convex bookkeeping with the original actor, wallet mode, hash, operation ID, escrow, job, and milestone references.
- `dispute-marking-status.tsx` and `dispute-status-badge.tsx` keep local pending/recording recovery visible even if the subscription reports `marked`; persisted Convex timeline events remain the only timeline source.

## Regression matrix

`dispute-marking-status.test.tsx`, `open-dispute-dialog.test.tsx`, and the real `dispute-participant-integration.test.tsx` add focused lifecycle/opening/integration tests covering:

- repeated clicks during deferred preparation/chain work and deferred final opening bookkeeping;
- simulation/signing rejection, signed-hash persistence failure, known-hash submission timeout, hashless passkey uncertainty, and successful confirmation;
- independent dispute-callback, transaction, and parent-escrow bookkeeping failures, with recovery that submits Stellar exactly once;
- recording recovery visibility when the live detail already says `marked`, hash-derived explorer links, accessible status/alert messaging, terminal/hash/uncertain retry gates, and historical timeline preservation through the real detail/timeline integration fixture;
- permission revocation, case navigation, network changes, and wallet-mode changes invalidating stale completions. Disconnect and unmount use the same execution-scope cleanup guard; no stale completion may update the replacement view.

## Validation

| Command | Result |
| --- | --- |
| `pnpm --filter web test features/disputes` | Pass — 68 tests across 9 files |
| `pnpm --filter web test` | Pass — 347 tests across 23 files |
| `pnpm --filter web exec tsc --noEmit` | Pass |
| Scoped `oxlint` on participant dispute files | Pass — 0 warnings, 0 errors |
| Scoped `oxfmt --check` on participant dispute files | Pass |
| `pnpm --filter web build` | Pass — Next.js production build and static generation completed |

## Remaining limitations

This is local mocked frontend/wallet/Convex evidence. It does not prove wallet possession for participant Convex arguments, live Stellar RPC behavior, cryptographic wallet/passkey signing, deployed contract compatibility, or event ingestion. The browser recovery state remains in memory; there is no participant reconciliation service, durable browser recovery, cross-tab execution guarantee, or live transaction monitor. A confirmed chain hash remains the source for explorer/reconciliation work, and incomplete bookkeeping still requires the existing detail retry path.
