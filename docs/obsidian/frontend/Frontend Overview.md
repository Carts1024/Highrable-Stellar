---
type: reference
area: frontend
status: current
last_updated: 2026-10-18
source_of_truth: repository
---

# Frontend Overview

`apps/web` is a Next.js 16.1.6 App Router application using React 19, TypeScript, Convex React, Stellar SDK 14.2.0, Stellar Wallets Kit, `smart-account-kit`, React Query, and shared `@repo/ui`.

## Runtime composition

- `app/layout.tsx` provides fonts, metadata, global CSS, providers, and `AppShell`.
- Font variables are defined in `app/globals.css` using the Space Grotesk and JetBrains Mono family names with system fallbacks; the app does not fetch Google Fonts during builds.
- `core/providers/app-providers.tsx` constructs the Convex client and composes wallet/UI/onboarding/debugger providers.
- `core/wallet` owns external wallet connection, authentication, funding checks, persistence, and identity state.
- `core/passkeys` and `core/stellar` own passkey readiness, smart-account configuration, contract calls, asset/payment helpers, and transaction execution.
- `features` contains domain-specific pages/hooks/components.
- `core/analytics/google-analytics.tsx` initializes the Google Analytics 4 tag and records page views for initial loads and App Router path changes. Dynamic routes are sent as route templates; query strings and page titles are omitted. The GA4 data stream must have browser-history page changes disabled because the app sends those page views manually.

## Data access

Browser features import `api` and typed Convex document/ID helpers from `@repo/convex-client`. They call Convex queries/mutations/actions directly through Convex React. Chain operations use `apps/web/core/stellar` and then write/update Convex records as a separate step.

## Server-rendered read surfaces

SEO helpers use a server Convex client for job detail, public profiles, and proof metadata. Do not assume a page’s server SEO query is the same as its client workflow query.

The v2 landing page defaults to light mode and scopes dark token overrides to `prefers-color-scheme: dark` in `apps/web/app/globals.css`.

The landing page uses CSS scroll-snap (`scroll-snap-type: y mandatory` on `html:has(.landing-v2-page)`, `scroll-snap-align: start` on each `main > section`, `end` on the footer) so one ~`100svh` section shows at a time. It is scoped via `:has()` so other routes scroll normally; `prefers-reduced-motion` disables smooth scrolling.

Responsive behavior of the landing page:

- Layout is fluid Tailwind (`px-4 sm:px-6`, fluid section padding, reflowing grids); horizontal overflow is clipped on `.landing-v2-page`.
- On large displays `html:has(.landing-v2-page)` sets `font-size: clamp(1rem, min(0.8334vw, 1.48vh), 1.75rem)`, so every rem-based size and `max-w-*` scales up (limited by the tighter of width/height) instead of leaving content small in an empty screen.
- Snap stays `mandatory` only while every section fits the viewport. `V2SnapGuard` (`v2-snap-guard.tsx`) sets `data-snap-overflow` on `<html>` when any section is taller than the viewport, and CSS then switches to `proximity` with `scroll-snap-stop: normal` (a media query for phones/short screens does the same before hydration). Mandatory snapping otherwise skipped the lower part of oversized sections.
- `V2Reveal` scales its x/y travel by 0.6 below 640px; the demo video width is capped by viewport height so it fits short laptops; inline nav links show from `lg` up.

Section content reveals use `V2Reveal` in `apps/web/features/landing-v2/components/v2-animated-elements.tsx`: a Framer Motion wrapper (opacity/transform only) that replays each time an element enters the viewport, enters against the scroll direction (tracked by one shared passive scroll listener), and supports a `delay` for staggering. `EditorialSectionLabel` uses it; under `prefers-reduced-motion` it renders in its final state with no motion.

## Product UI conventions

Product routes (everything inside `AppShell`) use a restrained, neutral style; the landing page has its own marketing styles and must not change with product UI work.

- **Landing isolation.** `AppShell` sets `data-mode` on the shell and `<html>` only for non-marketing routes. App overrides in `apps/web/app/globals.css` (flat primary buttons, no card shadows or hard hover shadows, neutral section headers) are scoped to `[data-mode]`, so they never reach `/` or `/home`. The landing page also renders `Footer`, `WalletConnectTrigger`, and `PasskeySmartAccountCard`; treat those three as landing-owned and leave `packages/ui` marketing primitives (`SectionLabel`, `HighrableV2Metric`, `HighrableV2Bullet`, `hr-v2-*` classes) to the landing page.
- **Page headers.** `ProductPageHero` (`features/common/components/layout/product-page-hero.tsx`) renders a plain title row: `title`, optional `description`, optional `meta` line, and right-aligned `actions`. No eyebrow pills, two-tone titles, or entrance animation.
- **Status.** `StatusText` (`features/common/components/status-text.tsx`) renders status as text with a coloured dot (`neutral | info | warning | success | danger`). Marketplace, job-safety, deadline, dispute, cancellation, agreement, and client-reliability badges all map onto it; `escrow-status.ts` and `job-safety.ts` expose a `tone` instead of badge class strings.
- **Lists and figures.** Work items use `WorkList`/`WorkListRow`/`WorkMeta` (`features/common/components/work-list.tsx`): one bordered list with dividers, amount right-aligned. Figures use `StatCard` (label, value, optional description; no icon or tone) grouped in a single divided strip.
- **Callouts and empty states.** `RouteCallout` and inline notices use a left rule with a light tint; `RouteEmptyState` is a compact dashed row. Hide panels that would only say "nothing here" when that adds no information (for example, deadline reminders).
- **Mode identity.** Client = yellow, Freelancer = orange, applied through the theme `--primary` (primary buttons), the active nav bar, and active tab underlines. Admin keeps the orange-to-yellow `--mode-gradient` on the active nav bar and the `AdminMark` (`features/admin/components/admin-mark.tsx`) above admin page titles.

## Common change locations

- Route composition: `apps/web/app`.
- Domain UI: `apps/web/features`.
- Wallet/chain behavior: `apps/web/core/wallet`, `core/passkeys`, `core/stellar`.
- Shared primitives: `packages/ui/src/components/ui`; product-UI primitives: `apps/web/features/common`.
- Cross-cutting environment: `apps/web/core/config/env.ts`.

See [[frontend/Routes and API]], [[frontend/Feature Slices]], and [[frontend/Wallet and Stellar Client Layer]].
