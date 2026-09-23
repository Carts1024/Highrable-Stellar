---
type: module
area: identity
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Profiles and Reputation

## Purpose

Represent wallet-linked users/profiles and expose completed-work reputation and client trust surfaces.

## Current Status

Implemented for public freelancer/client profile routes, Convex reputation mirrors, and Soroban completion data. Directory-wide talent search is not implemented.

## Primary Locations

- `packages/backend/convex/users/`
- `packages/backend/convex/profiles.ts`
- `packages/backend/convex/reputation_records/`
- `contracts/reputation/src/lib.rs`
- `apps/web/features/profile/`, `client-profile/`, `talent/`
- `apps/web/app/freelancers/[walletAddress]/`, `clients/[walletAddress]/`, `talent/`

## Responsibilities

- Store normalized wallet address, role, wallet type, names, handles, skills, links, and onboarding state.
- Build freelancer public profiles with completion/reputation data.
- Build client trust profiles with job, escrow, report, and payment-derived data.
- Mirror release-backed reputation into `reputationRecords` and query it by freelancer/job/milestone/escrow.

## Main Entry Points

Users: `upsertUser`, `recordWalletIdentity`, `completeOnboarding`, and user queries. Profiles: `updateFreelancerProfile`, `updateClientProfile`, `getFreelancerProfile`, `getClientTrustProfile`. Reputation: `createReputationRecord` and reputation queries.

## Data Model

`users` is wallet-keyed and supports `client`, `freelancer`, `admin` plus `external_wallet`/`passkey_smart_account`. `reputationRecords` links an escrow/job/milestone to client/freelancer, amount, rating, optional review text/hash, tx hash, and timestamp.

## External Dependencies

Soroban reputation contract, Convex escrow sync, public profile routes, and optional avatar storage.

## Internal Dependencies

Jobs, escrows, applications, transactions, reports, and wallet identity.

## Important Flows

```text
wallet/passkey identity → onboarding → profile
released escrow → contract record_completion → optional sync → Convex reputationRecords
profile route → public stats and verified work/review queries
```

## Common Change Locations

Use `users/schema.ts` for role/wallet enum changes; `profiles.ts` for profile response composition; `reputation_records/` for Convex mirror rules; `contracts/reputation` for on-chain record semantics.

## Risks / Gotchas

- Convex record creation must correspond to a released escrow and should not be treated as independent proof of chain settlement.
- `average_rating` on chain is integer division of total rating by completed count.
- Profiles are wallet-address based; switching between external and passkey modes can represent distinct addresses for the same human.

## Related Notes

[[contracts/Reputation Contract]], [[stellar/Wallet Identity Model]], [[modules/Marketplace and Jobs]]
