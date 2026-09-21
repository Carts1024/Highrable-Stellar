---
type: reference
area: frontend
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Feature Slices

| Slice | Main responsibility | Common entry points |
| --- | --- | --- |
| `admin` | Admin dashboard, dispute queue/detail, session gate, metrics/settlement UI. | `admin-dashboard-page.tsx`, `admin-disputes-page.tsx`, `admin-dispute-detail-page.tsx` |
| `attachments` | Uploads, attachment lists, protected viewer, access actions. | `components.tsx`, `protected-viewer.tsx` |
| `cancellations` | Cancellation request, eligibility, response, on-chain status/actions. | `components/`, `hooks/` |
| `chat` | Parent-linked collaboration UI. | `index.ts` plus consuming feature components |
| `client-profile` / `profile` | Public client trust/freelancer profile and editing. | `client-profile-page.tsx`, `freelancer-profile-page.tsx` |
| `dashboard` | Role-aware client/freelancer summaries and lists. | `dashboard-page.tsx`, dashboard hooks |
| `deadlines` | Deadline badges, reminder/notification panel. | `deadline-badge.tsx`, `notifications-panel.tsx` |
| `disputes` | Participant dispute list/detail and retryable chain marking. | `lib`, `types`, index exports |
| `jobs` | Job browsing/listing surface. | `jobs-page.tsx` |
| `landing` / `landing-v2` | Marketing/landing pages. | `landing-page.tsx`, `landing-v2-page.tsx` |
| `marketplace` | Marketplace, job detail, application, escrow and sync hooks. | `marketplace-page.tsx`, `job-detail-page.tsx`, hooks |
| `onboarding` | Wallet-linked profile setup and avatar upload. | `onboarding-page.tsx` |
| `post-job` | Job creation UI. | `post-job-page.tsx` |
| `proof` | Public escrow proof page and status/timeline/reputation display. | `escrow-proof-page.tsx` |
| `talent` | Planned directory presentation only. | `talent-page.tsx` |
| `work-agreements` | Agreement review and agreement UI. | `components.tsx`, index exports |
| `work-submissions` | Delivery/proof UI. | `index.ts` and consuming surfaces |

## Cross-slice rules

- Use `@repo/convex-client` types rather than duplicating Convex document shapes.
- Use `core/stellar` for every direct chain operation; feature hooks coordinate UX and Convex bookkeeping.
- Use `core/wallet` identity instead of reading external/passkey contexts independently when a feature needs the active actor.
- Keep privacy/participant checks in backend helpers even if the UI hides a control.

See [[modules/README]], [[architecture/Frontend Architecture]], and [[frontend/Wallet and Stellar Client Layer]].
