---
type: architecture
area: frontend
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Frontend Architecture

## Composition

`apps/web/app/layout.tsx` loads shared styles, SEO metadata, and `AppShell`. `AppProviders` composes:

1. Convex React provider using `getConvexClient()`.
2. Wallet provider with React Query, external wallet context, and passkey smart-account context.
3. `@repo/ui` providers/theme.
4. Onboarding route guard and the optional Highrable debugger.

The root page and `/home` render the landing-v2 surface. Route files are thin: they select metadata, parse route parameters, and render a feature page.

## Feature-sliced layout

- `features/marketplace`, `jobs`, and `post-job` cover discovery, detail, proposals, and creation.
- `features/dashboard`, `profile`, `proof`, and `talent` cover read-oriented surfaces.
- `features/work-agreements`, `work-submissions`, `attachments`, `chat`, `deadlines`, `disputes`, and `cancellations` cover the delivery lifecycle.
- `features/admin` is the admin dashboard/dispute console.
- `core/stellar`, `core/wallet`, and `core/passkeys` contain cross-cutting integration logic and should remain the first places to inspect for chain/wallet changes.

Avoid adding a vault note or architectural abstraction for every React component. Start with the feature slice, then follow its hooks into the Convex API or Stellar helper.

## Shared UI boundary

`@repo/ui` is consumed through workspace subpath exports. `src/components/ui` contains generic primitives; `src/components/ui-customs`, `src/components/sidebar`, and `src/components/highrable` contain progressively more product-aware components. Email templates and UI providers also live there. Highrable-specific data fetching and workflow rules remain in `apps/web`.

## Route gating and server/client split

`apps/web/proxy.ts` applies the waitlist-only browser gate to non-API, non-static paths. It intentionally does not change API authorization. Server API routes use Node runtime and are documented in [[frontend/Routes and API]] and [[backend/Admin and Server Routes]].

## Common change locations

- Page wiring: `apps/web/app/**/page.tsx`.
- Feature behavior: `apps/web/features/<domain>/`.
- Convex client/provider: `apps/web/core/providers/`, `packages/convex-client/src/`.
- Wallet identity and connection: `apps/web/core/wallet/`.
- Contract invocation and asset logic: `apps/web/core/stellar/`.
- Cross-cutting configuration: `apps/web/core/config/env.ts` and `apps/web/core/config/stellar-contracts.ts`.

See [[Feature Slices]], [[Wallet and Stellar Client Layer]], and [[Routes and API]].
