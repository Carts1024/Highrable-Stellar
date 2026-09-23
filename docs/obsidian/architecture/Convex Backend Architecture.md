---
type: architecture
area: backend
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Convex Backend Architecture

`packages/backend/convex/schema.ts` composes domain schemas. Each domain normally keeps its table definition, queries, mutations, helpers, and types together; a thin top-level file such as `convex/jobs.ts` re-exports the public functions from that domain.

```text
schema.ts
  ├── domain/schema.ts tables and validators
  ├── domain/queries.ts public reads
  ├── domain/mutations.ts public writes
  └── domain/helpers.ts normalization, authorization, relationships

sync.ts actions
  └── stellarReads.ts RPC simulations
        └── syncMutations.ts internal mirror updates
```

## Function classes

- Queries read Convex state and frequently accept a wallet address for participant filtering.
- Mutations validate and update product records, create timeline/system-message/notification side effects, and store transaction metadata.
- Actions perform external I/O, especially Stellar RPC reads, before calling internal mutations.
- Internal mutations are used for sync application and scheduled deadline work.

## Authorization model

Domain helpers commonly normalize the caller-supplied wallet and compare it with job, escrow, agreement, submission, dispute, or cancellation participants. Admin functions additionally require the configured admin wallet and `HIGHRABLE_ADMIN_CONVEX_SECRET` through `admin/helpers.ts`.

This is not yet uniform signed-session authorization. Several public mutations contain explicit TODOs to replace wallet-address trust with signed wallet session/auth. Treat a wallet string supplied to Convex as an authorization limitation, not proof of possession.

## External component

`convex/convex.config.ts` installs the `@convex-dev/resend` component. Waitlist email behavior depends on that integration and the backend environment, but the repository does not introduce a separate API gateway.

## Common change locations

- Schema/table shape: `packages/backend/convex/<domain>/schema.ts` and `convex/schema.ts`.
- Public function behavior: `queries.ts` or `mutations.ts` in the domain.
- Cross-domain invariants: domain `helpers.ts`.
- Chain reads/mirror behavior: `convex/lib/stellarReads.ts`, `sync.ts`, and `syncMutations.ts`.
- Scheduled behavior: `convex/crons.ts` and `deadlines/mutations.ts`.

See [[data/Convex Schema]], [[backend/Domain Functions]], and [[backend/Sync and Scheduled Jobs]].
