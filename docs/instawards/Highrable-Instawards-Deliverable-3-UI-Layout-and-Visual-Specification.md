---
title: Highrable Instawards Deliverable 3 — UI Layout and Visual Specification
type: ux-design-specification
status: implementation-grounded
date: 2026-10-17
scope: Participant and administrator dispute surfaces
source_of_truth: Repository source and checked-in documentation
reviewed_baseline: b55741894d2d127d81aea484f1f4b55fb049cba5
reviewed_head: bd169f860a69b97f72e47b995a14df73821ac9d8
inputDocuments:
  - docs/obsidian/Home.md
  - docs/obsidian/Repository Map.md
  - docs/obsidian/frontend/Frontend Overview.md
  - docs/obsidian/frontend/Feature Slices.md
  - docs/obsidian/frontend/Routes and API.md
  - docs/obsidian/modules/Disputes and Cancellations.md
  - docs/instawards/Highrable-Instawards-Deliverable-3-Sprint-Plan.md
  - docs/instawards/Highrable-Instawards-Deliverable-3-Implementation-Review.md
stepsCompleted: [1]
---

# Highrable Instawards Deliverable 3 — UI Layout and Visual Specification

This document describes the layout, containers, cards, lists, tables, typography, colors, spacing, controls, states, and responsive behavior for the Deliverable 3 participant and administrator dispute workflow.

It is grounded in the current implementation. Values marked **implemented** are observed in source. Values marked **canonical recommendation** consolidate existing patterns for future UI work; they do not claim that every current component already uses one shared primitive.

## 1. Product visual direction

Highrable’s operational UI should feel:

- **Trustworthy:** clear borders, explicit states, visible transaction references, and restrained decoration.
- **Technical but readable:** monospaced labels and identifiers paired with a friendly geometric sans body font.
- **Editorial and structured:** generous section spacing, strong headings, uppercase eyebrow labels, and modular panels.
- **Calm under failure:** neutral pending states, amber reconciliation warnings, and red errors with direct recovery actions.

The default product surface is light mode: white page background, near-black primary text, gray borders, and orange used for action, focus, and Highrable identity. Gradients are reserved for primary actions and selected hero/title treatments; operational data panels should remain mostly flat.

## 2. Page and layout system

### 2.1 Global application shell — implemented

- Non-marketing routes render inside `AppShell`.
- Header: sticky at the top, `z-50`, white background, 64px high (`h-16`), with a subtle bottom shadow after the user scrolls more than 8px.
- Main shell: `min-h-screen`, background `var(--background)`, foreground `var(--foreground)`.
- Shell content: `max-w-7xl`, centered, `px-6`, vertical padding `py-10` and `sm:py-12`.
- Footer follows the page content.
- Marketing routes `/` and `/home` intentionally bypass the product header/footer shell and use the landing-v2 layout instead.

### 2.2 Route content widths — implemented

| Surface | Container | Padding | Primary use |
| --- | --- | --- | --- |
| Participant disputes list/detail | `max-w-5xl` | `px-4 py-10` | `/disputes`, `/disputes/[disputeId]` |
| Admin dashboard/queue/detail | `max-w-6xl` | `px-4 py-10` | `/admin`, `/admin/disputes`, `/admin/disputes/[disputeId]` |
| Shared product hero | `max-w-4xl`, inner copy `max-w-3xl` | inherited | Product route titles and descriptions |
| Shared v2 container | `max-w-7xl px-6` | inherited | Header and marketing components |

Use one route container per page. Avoid adding another full-width max-width wrapper inside a section unless the section intentionally needs a narrower reading measure.

### 2.3 Vertical rhythm — canonical recommendation

- Page sections: `24px` between major blocks (`space-y-6`).
- Section header to body: `20–24px` (`p-5`/`p-6` body and a bottom border on the header).
- Card internals: `12–16px` (`gap-3`/`gap-4`).
- Label to control: `6–8px` (`gap-1.5`/`gap-2`).
- Inline action groups: `8px` (`gap-2`).
- Timeline items: `12px` between cards; `24px` left offset from the vertical rule.

Keep the 4px base rhythm: `4, 8, 12, 16, 20, 24, 32, 40, 48px`. Prefer the existing Tailwind spacing utilities instead of arbitrary pixel values.

### 2.4 Responsive breakpoints — implemented behavior

- Base/mobile: one-column layout; content wraps; queue headers are hidden; actions move below content.
- `sm` / 640px: route section padding grows from `20px` to `24px`; two-column metric and evidence grids become available.
- `md` / 768px: navigation becomes desktop; participant metadata can use two columns; admin filters begin to align horizontally.
- `lg` / 1024px: admin queue uses its four-column desktop grid; participant composers use two columns; admin hero gains a right metric rail; workspace forms become two or three columns.
- `xl` / 1280px: breakdown matrices can use three value columns.

Never require horizontal scrolling for a primary action or essential status. Wide data sets may scroll inside a bounded table container, but the queue intentionally reflows into stacked rows below `lg`.

## 3. Design tokens

### 3.1 Color tokens — implemented

| Token/use | Light value | Dark value where defined | Use |
| --- | --- | --- | --- |
| Page background | `#ffffff` | `#171717` | Body and main route background |
| Primary text | `#0a0a0a` | `#fafafa` | Headings, primary values, important content |
| Body secondary text | `#5f5f5f` | `#d4d4d4` | Descriptions, metadata, helper copy |
| Muted text | `#7f7f7f` | `#a3a3a3` | Timestamps, unavailable references, labels |
| Strong body copy | `#3f3f3f` | — | Long-form descriptions and timeline messages |
| Card/surface | `#ffffff` | `#1f1f1f` | Panels and cards |
| Muted surface | `#f5f5f5` | `#262626` | Empty states, secondary blocks, table headers |
| Soft surface | `#fafafa` | — | Evidence items, queue rows, neutral state blocks |
| Border | `#e8e8e8` | `#3a3a3a` | Standard borders and dividers |
| Soft border | `#d8d8d8` | — | Inputs, timeline rules, dashed empty-state borders |
| Accent surface | `#fff7ed` | `rgb(255 112 3 / 18%)` | Orange-tinted notices, secondary actions |
| Orange 1 | `#ff8801` | — | Focus ring and bright gradient stop |
| Orange 2 | `#ff7003` | — | Primary brand/action orange |
| Orange 3 | `#e85d00` | — | Strong action border/hover |
| Orange 4 | `#b94a00` | — | Accessible accent text and dark-orange links |
| Focus ring | `#ff7003` | `#ff8801` | Visible keyboard focus |
| Destructive | `#dc2626` | `#7f1d1d` | Destructive controls and errors |

State colors use the existing Tailwind families:

| State | Border | Background | Text |
| --- | --- | --- | --- |
| Success | `emerald-200` | `emerald-50` | `emerald-700` or `emerald-800` |
| Warning/reconciliation | `amber-200` | `amber-50` | `amber-800` or `amber-900` |
| Danger/error | `red-200` | `red-50` | `red-700` |
| Neutral/pending | `#d8d8d8` or `border-border` | `#fafafa` or `muted/40` | `#3f3f3f` or secondary text |

Use text and icon labels in addition to color. A transaction marked “Outcome Pending” must not be conveyed only by gray or amber.

### 3.2 Typography — implemented

Font variables are named `--font-geist-sans` and `--font-geist-mono`, but their actual stacks are:

- Sans: `"Space Grotesk", "Segoe UI", system-ui, sans-serif`.
- Mono: `"JetBrains Mono", "Cascadia Mono", Consolas, monospace`.

The repository does not fetch Google Fonts during builds. If Space Grotesk or JetBrains Mono is unavailable on the device, the declared fallbacks are used.

| Text role | Font | Size/weight | Treatment |
| --- | --- | --- | --- |
| Product route H1 | Sans | `30px` (`text-3xl`), `36px` from `sm`; bold/semibold | Tight leading, primary text; orange gradient may emphasize one phrase |
| Participant detail title | Sans | `24px`, semibold | `leading-tight` |
| Section title | Sans | `18–20px`, semibold | Use for card and panel titles |
| Body | Sans | `14px` default; `16px` where comfortable | `leading-relaxed` for descriptions |
| Eyebrow/section label | Mono | `11–12px`, medium | Uppercase, tracking `0.04–0.08em` |
| Button/navigation label | Mono | `12–14px`, medium | Uppercase, often tracking `0.06em` or wider |
| Wallet/hash/operation ID | Mono | `12–14px` | `break-all` where necessary; never truncate without an accessible full value |
| Metric value | Sans | `24px`, semibold | `leading-none` |
| Badge/status | Mono | `10–12px` | Uppercase; compact padding |

Use sans for prose and human-readable titles. Use mono for IDs, statuses, dates, labels, wallet addresses, transaction hashes, and action labels.

### 3.3 Shape and elevation — implemented patterns

- Standard participant card radius: `rounded-lg` = 8px.
- Shared `RoutePanel` radius: `var(--radius)` = 8px; the base `Card` primitive defaults to `rounded-xl` = 12px.
- Admin operational sections: square corners by design; use a 1px border and no radius.
- Metric cards: `rounded-md` with a 3px orange left rule and `shadow-sm`.
- Primary surfaces: borders do most of the visual work; avoid adding shadows to every panel.
- Hard Highrable hover shadow: `5.67px 5.67px 0 rgba(0,0,0,.08)`; strong variant uses `.2` opacity. Reserve this for interactive v2 panels and buttons.

The current UI intentionally has two surface languages: rounded participant/product cards and square-edged admin operations panels. Preserve that distinction unless a future design-system pass unifies it.

## 4. Container patterns

### 4.1 Route panel — implemented

`RoutePanel` is the reusable product container:

- Card background: `var(--card)`.
- Border: `1px solid var(--highrable-border)`.
- Radius: 8px.
- No shadow by default.
- Header: `px-6`, bottom border, `pb-5`; title and description grouped with `gap-4`.
- Optional icon: 40×40px, rounded 12px, orange accent surface.
- Header action: right-aligned, wraps below on narrow screens.

Use `RoutePanelHeader` for page-level blocks that need an eyebrow, title, description, icon, or action.

### 4.2 Admin section — implemented

`AdminSection` is the primary administrator container:

- Outer: square, white, 1px `#e8e8e8` border.
- Header: flex-wrap layout, `p-5` on mobile and `p-6` from `sm`, bottom border.
- Header content: max width `48rem` (`max-w-3xl`), `gap-2` between eyebrow/title/description.
- Body: `p-5` on mobile and `p-6` from `sm`.
- Actions: right side, wrap with `gap-2`.
- Sections are separated vertically by `24px`.

Use this container for filters, queue health, metrics, evidence review, assignment, moderator workflow, settlement, recovery, and audit timeline.

### 4.3 Callouts and empty states — implemented

`RouteCallout`:

- Inline flex layout, icon optional, `gap-3`, `rounded-xl`, 1px border, `px-4 py-3`, `text-sm`.
- Neutral: `border-border bg-muted/40`.
- Warning: amber border/background/text.
- Danger: red border/background/text.
- Success: emerald border/background/text.

`RouteEmptyState`:

- Muted surface, dashed border, `rounded-xl`, centered content, `px-6 py-10`.
- Optional icon: circular, bordered, background `var(--background)`, `p-3`.
- Title: small semibold primary text.
- Description: small secondary text, max width `max-w-xl`.

Use empty states for “no disputes,” “no timeline events,” and “no linked records.” Use callouts for loading, access, consistency, network, and recovery messages.

## 5. Card and list specifications

### 5.1 Participant dispute list card — implemented

Used on `/disputes`:

- Wrapper: `article`, `rounded-lg`, 1px `#e8e8e8` border, white background, `p-4`.
- Cards are separated by `12px` (`space-y-3`).
- Header uses `flex-wrap`, `items-start`, `justify-between`, `gap-3`.
- Left content: dispute number in 12px mono uppercase muted text; title at 18px semibold; reason/date/role at 14px secondary text.
- Right content: status and on-chain badges in a wrapping `gap-2` row.
- Action row: top margin 12px, right-aligned “View Dispute” secondary button.
- Do not turn this into a dense table on mobile; the card preserves the narrative hierarchy.

### 5.2 Participant detail summary card — implemented

Used on `/disputes/[disputeId]`:

- Wrapper: rounded 8px, 1px border, white, `p-5`.
- Top row: dispute number + 24px title on the left; status badges on the right; both wrap.
- Metadata: 2 columns from `md`, `gap-3`, 14px values. Labels are mono, 12px, uppercase, muted.
- Wallet values use `break-all` and must remain fully copyable.
- Description: 14px, `#3f3f3f`, `whitespace-pre-wrap`, top margin 16px.
- Marking status block: nested rounded 8px status panel, `p-3`, `text-sm`, `space-y-3`.

### 5.3 Agreement and evidence blocks — implemented

- Agreement context and evidence use a secondary `#fafafa` background, rounded 8px, border, `p-5`.
- Section titles are 18px semibold, primary text.
- Attachment lists are read-only in the participant detail surface.
- Use a neutral no-content state rather than an empty white rectangle.

### 5.4 Participant composer cards — implemented

Evidence and response forms sit side by side from `lg` and stack below it:

- Grid: `gap-4`, `lg:grid-cols-2`.
- Form card: rounded 8px, 1px border, white, `p-4`, `space-y-3`.
- Form title: mono, 12px, uppercase, muted.
- Labels: sans, 14px, `#3f3f3f`.
- Textarea: response minimum height 112px; evidence minimum height follows the shared textarea primitive unless overridden.
- Upload control appears below the text field.
- Validation errors: 14px red text, `role="alert"`; retain user draft state after a rejected write.
- Submit buttons stay disabled while uploads are pending or a mutation is running.

### 5.5 Timeline event card — implemented

Participant timeline:

- Ordered list uses `space-y-3`.
- Each item has a 1px left rule in `#d8d8d8`, `pl-4`.
- Inner card: rounded 8px, 1px border, white, `p-4`.
- Event label and date are 12px mono; event label uppercase; date muted.
- Message is 14px primary text with `mt-2`.
- Actor, status transition, transaction hash, and attachments are additional `mt-2`/`mt-3` rows.
- Transaction hashes are monospaced, breakable, and linked to Stellar Expert.

Administrator timeline:

- Lives inside an `AdminSection`.
- Uses a border-left audit rail, `pl-6`, with 10px square orange-tinted event markers.
- Each event uses a two-column grid at `lg`: message plus a 190px right-aligned timestamp.
- Timeline evidence is rendered separately from case evidence but uses the same evidence-item component.

### 5.6 Admin metric card — implemented

`HighrableV2Metric` is used for platform totals, queue health, and detail status:

- Rounded 6px, 1px left border with `border-highrable-orange-2` and 3px thickness.
- `px-4 py-3`, `shadow-sm`.
- Label: `hr-label-caps`, 12px mono, muted, uppercase.
- Value: 24px semibold primary, `leading-none`, top margin 4px.
- Description: 12px secondary text, relaxed line-height, top margin 8px.
- Metric rail: one column on mobile, two columns from `sm`, four columns from `lg`.

### 5.7 Evidence item — implemented

- Evidence list: `grid gap-2`, two columns from `sm`.
- Item: `flex`, wraps, `gap-4`, 1px border, `#fafafa` background, `px-3 py-3`.
- Name: 14px semibold, primary, truncated visually but the accessible open action names the full attachment.
- Metadata: 12px secondary text, wrapping across type, uploader, size, and date.
- Available state: emerald 12px semibold label.
- Missing/blocked/deleted/invalid/URL-unavailable states: red state label plus explanatory 12px copy and referenced record ID where available.
- “Open …” action: mono, approximately 11px, uppercase, dark orange; opens in a new tab with `rel="noopener noreferrer"`.

### 5.8 Linked-record item — implemented

- Grouped into Submissions, Revisions, Messages, and Deadlines.
- Groups use a two-column layout from `sm`.
- Item: bordered, `#fafafa`, `px-3 py-2`, wraps the ID and the availability note.
- IDs: 12px mono, break-all, primary.
- Never imply that protected content was loaded when the detail view only has a reference ID.

## 6. Tables, grids, and dense data

### 6.1 Shared table primitive — implemented

The generic `Table` component provides:

- Outer wrapper: `relative w-full overflow-x-auto`.
- Table: `w-full`, caption below, 14px text.
- Header: bottom border on rows.
- Header cell: 40px high, `px-2`, left-aligned, middle-aligned, medium weight, no-wrap.
- Body cell: `p-2`, middle-aligned, no-wrap.
- Body rows: bottom border, `hover:bg-muted/50`, selected rows use muted background, transition colors.
- Last body row: no bottom border.
- Footer: muted 50% background, top border, medium weight.
- Caption: muted 14px text, `mt-4`.

Use the semantic table primitive when the data truly has column/row relationships. Keep the overflow wrapper so narrow screens can access all columns.

### 6.2 Admin dispute queue — implemented CSS-grid table

The current dispute queue is not rendered with `<Table>`. It is a semantic list that visually behaves like a table:

- Outer wrapper: `overflow-hidden`, 1px `#e8e8e8` border.
- Desktop header appears only at `lg` and above.
- Desktop columns: `minmax(220px, 1fr) 180px 220px 130px`.
- Header: `#fafafa`, bottom border, `px-4 py-3`, 12px mono uppercase, `#7f7f7f`, tracking `0.06em`.
- Row: grid, `gap-4`, `px-4 py-4`, bottom divider, vertically centered at desktop.
- Dispute column: 12px mono dispute number, 16px semibold title, 12px metadata.
- Reason column: 14px secondary text.
- Status column: wrapping badges with `gap-2`.
- Action column: right-aligned at desktop, wrap-safe on smaller widths.
- Below `lg`: header is hidden and each row becomes a stacked card-like record; actions are left-aligned/wrap-safe.
- Assignment selects use 36px height, white background, 1px border, 12px text, max width 176px.

### 6.3 Admin breakdown matrix — implemented

- Outer: 1px border with horizontal `divide-y` separators.
- Group row: `p-4`, `gap-4`; at `lg`, a 180px label column plus a flexible value column.
- Group title: 12px mono uppercase, primary text, tracking `0.06em`.
- Group description: 12px muted text, relaxed line-height.
- Values: two columns from `sm`, three from `xl`.
- Each value: minimum height 40px, left border, `pl-3`, flex between label and count.
- Count: 14px mono medium primary text.

### 6.4 Table rules

- Align numeric values and counts consistently; use mono for counts and transaction data.
- Use `whitespace-nowrap` for labels that must remain atomic, but allow wallets, hashes, and references to break.
- Use status badges inside cells rather than long status prose.
- Keep action controls in the final column and make the action label explicit: “Review,” “Open Detail,” “Claim,” “Reconcile.”
- On mobile, prefer stacked records for operational queues. Use horizontal scrolling only when the user needs simultaneous column comparison.

## 7. Screen-by-screen layout

### `/disputes` — participant list

1. Page container: `max-w-5xl`, `px-4`, `py-10`.
2. Intro block: bottom margin 24px.
3. Eyebrow: “Highrable Review Flow,” 12px mono uppercase, secondary text.
4. H1: “Disputes,” 30px semibold, primary text, top margin 8px.
5. Description: 14px secondary text, top margin 8px.
6. Dispute cards follow with 12px vertical gaps.
7. Wallet disconnected, loading, and empty states use bordered white/soft-surface message blocks.

### `/disputes/[disputeId]` — participant detail

Order the page as:

1. Summary card with dispute title, status badges, metadata, description, and on-chain marking state.
2. Agreement context block.
3. Evidence block.
4. Participant action composers, if the case is still accepting evidence/responses.
5. Timeline heading with “All Disputes” secondary action.
6. Participant timeline.

Access and recovery states must appear in the same content width as the detail surface: connect wallet, loading, forbidden, not found, failed read, timeline failure, and retry.

### `/admin` — dashboard

1. Product hero: “Platform Operations / Highrable Admin Console.”
2. Right-aligned action row: open dispute console, manage admins, refresh metrics.
3. `AdminSection` for platform totals with four metric cards.
4. Optional warning callout if the dataset is truncated.
5. `AdminSection` for lifecycle breakdown matrix.
6. `AdminSection` for work-history metrics and breakdown matrix.
7. `AdminSection` for recent disputes using the admin queue in compact mode.

### `/admin/disputes` — queue

1. Product hero: “Manual Review / Admin Dispute Console.”
2. Right-aligned Back to Admin and Refresh actions.
3. `AdminSection` for queue controls: Status, Assignment, On-chain status, and helper text.
4. Callouts for membership loading/errors, assignment results, and queue read errors.
5. `AdminSection` for queue health metrics.
6. `AdminSection` for the dispute queue.

### `/admin/disputes/[disputeId]` — administrator detail

1. Two-column hero at `lg`: product hero on the left; status/on-chain/events metric rail on the right, fixed at approximately 420px.
2. Action row: Refresh detail, Back to Disputes, optional Resolution Transaction, optional Retry mark_disputed.
3. Retry-warning callout when a previous mark failed.
4. Case Brief panel: title, description, statuses, and a definition grid of case links/wallets/timestamps.
5. Case Evidence section.
6. Linked Records section.
7. Assignment section.
8. Pending transaction/recovery section when a settlement attempt is active.
9. Assignment guard callout when the current admin cannot act.
10. Moderator Workflow section for note/status updates.
11. Resolve Dispute On-Chain section for resolution, basis points, note, and action.
12. Settlement status section when an operation is active or has a result.
13. Action success/error callouts.
14. Audit Timeline section.

## 8. Controls and interaction states

### Buttons

- Base button: inline-flex, centered, 14px mono medium, rounded 6px, transition, visible focus ring.
- Default/primary: Highrable orange gradient, white text.
- Secondary: orange-tinted surface with orange text, or transparent orange border depending on the variant.
- Destructive: red surface/white text; use only for irreversible or clearly destructive actions.
- Sizes: default 36px high; small 32px; large 40px; icon 36px.
- Disabled: no pointer events, reduced opacity; for chain actions, also show a clear in-progress label such as “Resolving…” or “Reconcile…”.
- Hover: slight brightness/contrast change; shared global styles may add the hard shadow to interactive buttons.

### Inputs and selects

- Shared input height: 36px; admin custom selects commonly use 40–44px for form prominence.
- White or transparent surface, 1px border, 12px horizontal padding, 14px sans text.
- Focus: orange border plus 3px translucent orange ring.
- Labels: mono, 12px uppercase, muted; keep labels visible rather than relying on placeholders.
- Textareas: minimum 64px by primitive; workflow-specific fields use 96–144px minimum heights.
- Invalid fields use destructive border/ring and an adjacent `role="alert"` message.

### Status badges

- Rounded-md, not a pill, for dispute and chain statuses.
- `px-2 py-1`, mono, 12px, uppercase.
- Active/terminal success: emerald background/border/text.
- Open/review: orange-tinted background with dark-orange text.
- Cancelled: gray background/border/text.
- Mark failed: red background/border/text.
- Known transaction hash with unconfirmed state: label explicitly “Reconciliation Required.”

### Transaction state presentation

The UI must distinguish:

- Confirmed on Stellar: success styling, explorer link, no retry.
- Confirmation recording pending: neutral/pending styling, “Do not submit another transaction.”
- Outcome uncertain: neutral/pending styling, explorer/reconciliation guidance, no blind retry.
- Known hash with incomplete state: amber warning, reconciliation required, no new transaction.
- Hashless pre-submission failure: warning/error with a retry action when the dispute is nonterminal.
- Terminal case: explain that the case is closed and do not present a retry action.

## 9. Motion, focus, and accessibility

- Keep route and dialog transitions subtle: opacity/translate only, approximately 200–450ms where already implemented.
- Honor `prefers-reduced-motion`; do not rely on animation to communicate status.
- Maintain visible `:focus-visible` treatment using the orange ring.
- Every form field has a visible label and a stable `id`/`htmlFor` association.
- Async status uses `role="status"` and `aria-live` where appropriate; errors use `role="alert"`.
- Timeline is an ordered list; queue records are articles/list items; true row/column data should use semantic table markup.
- Ensure action labels describe the target: “Open Stellar Expert transaction,” “Retry recording confirmation,” and “Return to the dispute queue.”
- Do not expose protected evidence URLs unless the backend has authorized the viewer and returned a valid URL.
- Keep wallet addresses and hashes selectable/copyable; visual truncation must not remove the accessible value.

## 10. Modal and responsive-dialog pattern

The open-dispute flow uses `ResponsiveDialog`:

- Content max width: `max-w-3xl`.
- Header title: 20px, primary text; description: 14px secondary text.
- Body starts with an amber warning callout explaining that review pauses release/cancellation and does not automate judgment or fund splitting.
- Form uses a single-column `gap-4` stack.
- Fields: title, reason select, description textarea, latest-submission checkbox, related-revision checkboxes, attachment uploader.
- Inputs use 40px height, rounded 8px, `#d8d8d8` borders.
- Description textarea minimum height: 128px.
- Footer actions are right-aligned, wrapping on narrow screens: Cancel plus Open Dispute/Retry Opening Dispute.
- On successful save, show an amber result block with a link to the saved dispute and optional Stellar Expert transaction link.
- While submitting, prevent closing the dialog and lock fields to avoid duplicate case creation.

## 11. Implementation consistency notes

1. **Use tokens for new code.** Existing dispute/admin files use both token utilities and raw values such as `#e8e8e8`, `#FF7003`, and `#5f5f5f`. New work should prefer `border-border`, `hr-text-secondary`, `highrable-orange-2`, and related semantic tokens.
2. **The generic table primitive is not the current dispute queue.** The queue is a CSS-grid list with responsive row reflow. Do not describe it as a native table in product copy or accessibility tests unless it is migrated to semantic table markup.
3. **Admin and participant surfaces intentionally differ.** Participant cards favor rounded 8px surfaces and narrative hierarchy. Admin sections favor square borders, dense operational scanning, and explicit dividers.
4. **Dark mode is incomplete for operational surfaces.** Dark variables exist in the shared UI stylesheet, but several route components hard-code white backgrounds and light hex values. Treat the light theme as authoritative until a dark-mode audit is completed.
5. **Font variable names are legacy.** The variables are called Geist, but the declared design font is Space Grotesk. Do not introduce Geist-specific measurements without changing the token definition.
6. **Prefer shared route primitives for new panels.** Use `RoutePanel`, `RouteCallout`, `RouteEmptyState`, `AdminSection`, `HighrableV2Metric`, and the existing status badges before adding one-off container styles.

## 12. Source map

- Shared tokens and utility classes: `packages/ui/src/styles/globals.css`
- Shared card/table/button/input primitives: `packages/ui/src/components/ui/`
- Highrable v2 theme/metrics: `packages/ui/src/components/highrable/v2-theme.tsx`, `v2-marketing.tsx`
- Product shell and panels: `apps/web/features/common/components/layout/`
- Participant dispute list/detail/forms/timeline: `apps/web/features/disputes/components/`
- Admin sections, queue, evidence, dashboard, and detail: `apps/web/features/admin/`
- Participant routes: `apps/web/app/disputes/`
- Admin routes: `apps/web/app/admin/`

## 13. Verification checklist

- [ ] Page uses the correct route max width and horizontal padding.
- [ ] Major sections are separated by approximately 24px.
- [ ] Panels use a 1px border and the correct participant/admin corner treatment.
- [ ] Headings use sans; labels, statuses, IDs, and actions use mono.
- [ ] Primary orange is reserved for actions, focus, links, selected states, and Highrable emphasis.
- [ ] Success, warning, pending, and danger states include text labels and recovery guidance.
- [ ] Cards and queue rows reflow correctly at mobile widths.
- [ ] Wallets, transaction hashes, and record IDs remain readable and copyable.
- [ ] Loading, empty, forbidden, not-found, failed-read, and retry states are represented.
- [ ] Form labels, focus states, `role="status"`, `role="alert"`, and keyboard access are present.
- [ ] Protected evidence is never rendered from an unvalidated or unauthorized URL.
- [ ] New UI reuses semantic token classes and shared primitives where possible.

