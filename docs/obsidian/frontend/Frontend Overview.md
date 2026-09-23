---
type: reference
area: frontend
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Frontend Overview

`apps/web` is a Next.js 16.1.6 App Router application using React 19, TypeScript, Convex React, Stellar SDK 14.2.0, Stellar Wallets Kit, `smart-account-kit`, React Query, and shared `@repo/ui`.

## Runtime composition

- `app/layout.tsx` provides fonts, metadata, global CSS, providers, and `AppShell`.
- `core/providers/app-providers.tsx` constructs the Convex client and composes wallet/UI/onboarding/debugger providers.
- `core/wallet` owns external wallet connection, authentication, funding checks, persistence, and identity state.
- `core/passkeys` and `core/stellar` own passkey readiness, smart-account configuration, contract calls, asset/payment helpers, and transaction execution.
- `features` contains domain-specific pages/hooks/components.

## Data access

Browser features import `api` and typed Convex document/ID helpers from `@repo/convex-client`. They call Convex queries/mutations/actions directly through Convex React. Chain operations use `apps/web/core/stellar` and then write/update Convex records as a separate step.

## Server-rendered read surfaces

SEO helpers use a server Convex client for job detail, public profiles, and proof metadata. Do not assume a page’s server SEO query is the same as its client workflow query.

## Common change locations

- Route composition: `apps/web/app`.
- Domain UI: `apps/web/features`.
- Wallet/chain behavior: `apps/web/core/wallet`, `core/passkeys`, `core/stellar`.
- Shared primitives: `packages/ui/src/components/ui`.
- Cross-cutting environment: `apps/web/core/config/env.ts`.

See [[frontend/Routes and API]], [[frontend/Feature Slices]], and [[frontend/Wallet and Stellar Client Layer]].
