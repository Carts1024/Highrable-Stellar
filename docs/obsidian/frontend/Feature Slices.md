---
type: reference
area: frontend
status: current
last_updated: 2026-10-18
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
| `mode` | App-wide Freelancer/Client mode: provider, header switch, banner, `ModeGate`/`ModeOnly`, per-mode navigation. | `mode-provider.tsx`, `mode-config.ts`, `mode-gate.tsx` |
| `onboarding` | Wallet-linked profile setup and avatar upload. | `onboarding-page.tsx` |
| `post-job` | Job creation UI. | `post-job-page.tsx` |
| `proof` | Public escrow proof page and status/timeline/reputation display. | `escrow-proof-page.tsx` |
| `talent` | Planned directory presentation only. | `talent-page.tsx` |
| `work-agreements` | Agreement review and agreement UI. | `components.tsx`, index exports |
| `work-submissions` | Delivery/proof UI. | `index.ts` and consuming surfaces |

## UI mode and stepped forms

- `AppShell` wraps non-marketing routes in `AppModeProvider`. The mode (`freelancer` or `client`) reuses the per-wallet `highrable:dashboard:mode:<ADDRESS>` localStorage key and defaults from the user role. It is UI-only: it never changes backend authorization.
- The shell sets `data-mode` on its wrapper and on `<html>` (so portal dialogs inherit it). `apps/web/app/globals.css` re-points the `--highrable-orange-*` tokens to yellow under `[data-mode="client"]`; Freelancer keeps orange. `/admin` routes always use the default orange theme, a dedicated admin nav, and no mode switch.
- Client-only UI (`/post-job`, `/talent`, applicant lists, post-job button) is hidden in Freelancer mode, and apply forms/buttons are hidden in Client mode, using `ModeGate` (whole page) or `ModeOnly` (blocks).
- `features/common/components/form/form-stepper.tsx` provides `FormStepTabs`, `FormStepPanel`, `FormStepNav`. Inactive panels stay mounted (hidden) so form state and validation are unchanged. Used by `CreateJobForm` (4 steps) and `OnboardingPage` (3 steps). Failed validation jumps to the step that holds the error.
- Visual system: the page background is a mode tint (`--mode-page`) and every white container gets a mode-coloured border and soft shadow. Headings sit on a gradient band (`.hr-card-head`, `SectionCard`, `SectionHeading`); `/admin` uses an orange-to-yellow gradient (`data-mode="admin"`). `--primary` is re-pointed to the mode colour, so no black fills remain; text on yellow is dark (`--mode-on`).
- Summary cards use `StatCard` (or `HighrableV2Metric` with `tone` + `icon`) with pastel `hr-tone-*` backgrounds. Wallet addresses always use `WalletAddressTile` (sky blue, copyable). The header shows a profile shortcut (`HeaderProfileLink`) that opens the profile matching the current mode.
- Disputes (list, detail, composers, timeline, dialog) and admin pages share the same band/card/badge styling.
- `TermHint` (`features/common/components/term-hint.tsx`) holds plain-language definitions (`PLAIN_TERMS`) for jargon such as escrow and wallet.

## Cross-slice rules

- Use `@repo/convex-client` types rather than duplicating Convex document shapes.
- Use `core/stellar` for every direct chain operation; feature hooks coordinate UX and Convex bookkeeping.
- Use `core/wallet` identity instead of reading external/passkey contexts independently when a feature needs the active actor.
- Keep privacy/participant checks in backend helpers even if the UI hides a control.

See [[modules/README]], [[architecture/Frontend Architecture]], and [[frontend/Wallet and Stellar Client Layer]].
