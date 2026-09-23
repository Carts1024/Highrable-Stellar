---
type: reference
area: frontend
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Routes and API

## App routes

| Route | Entry point / purpose | Status |
| --- | --- | --- |
| `/` | `app/page.tsx`, landing-v2 | Implemented |
| `/home` | Alternate landing-v2 route | Implemented |
| `/marketplace` | Marketplace browsing | Implemented |
| `/jobs` | Job browsing | Implemented |
| `/marketplace/jobs/[jobId]` | Job detail, proposals, agreements, escrow actions | Implemented |
| `/post-job` | Job creation | Implemented |
| `/dashboard` | Client/freelancer/admin dashboard modes | Implemented |
| `/onboarding` | Wallet-linked profile onboarding | Implemented |
| `/freelancers/[walletAddress]` | Public freelancer profile | Implemented |
| `/clients/[walletAddress]` | Public client trust profile | Implemented |
| `/proof/[escrowId]` | Public escrow proof surface | Implemented |
| `/disputes` | Wallet-scoped disputes | Implemented |
| `/disputes/[disputeId]` | Participant dispute detail/timeline | Implemented |
| `/work-agreements/[agreementId]/review` | Freelancer agreement review | Implemented |
| `/admin` | Admin dashboard | Implemented, protected at runtime |
| `/admin/disputes` | Admin dispute queue | Implemented, protected at runtime |
| `/admin/disputes/[disputeId]` | Admin dispute detail/settlement | Implemented, protected at runtime |
| `/talent` | Planned discovery surface with preview cards | Placeholder; no live directory |

Dynamic job/profile/proof pages validate route parameters for SEO/404 behavior and may use server Convex reads for metadata.

## API routes

| Route | Behavior | Authorization |
| --- | --- | --- |
| `POST /api/auth/stellar/challenge` | Creates signed Stellar challenge and challenge cookie. | Payload validation; no prior session. |
| `POST /api/auth/stellar/verify` | Verifies signed challenge, consumes nonce, sets signed session cookie. | Challenge cookie + Stellar signature. |
| `GET /api/admin/metrics` | Fetches bounded admin metrics. | Signed session → configured admin wallet → Convex admin secret. |
| `GET /api/admin/disputes` | Filters admin dispute queue. | Same admin chain. |
| `GET /api/admin/disputes/[disputeId]` | Fetches admin dispute detail. | Same admin chain. |
| `POST /api/admin/disputes/[disputeId]/status` | Changes review status. | Same admin chain plus Zod body validation. |
| `POST /api/admin/disputes/[disputeId]/note` | Adds moderator note. | Same admin chain plus Zod body validation. |
| `POST /api/admin/disputes/[disputeId]/resolve` | Records started/succeeded/failed settlement phase. | Same admin chain plus bps/status/body validation. |

The listed admin API route records the outcome of chain operations; the direct chain call is performed by feature/stellar code before or around the phase update. `proxy.ts` excludes API paths from waitlist redirects and is not API authorization.

## Common change locations

- New route: matching folder under `apps/web/app`.
- API contract: matching route file plus `core/admin`/auth helper.
- Route metadata: `core/seo` and page-level `generateMetadata`.
- Feature implementation: matching `apps/web/features` slice.

See [[architecture/Authentication Boundaries]], [[backend/Admin and Server Routes]], and [[modules/Admin Operations]].
