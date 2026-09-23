---
type: module
area: operations
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Deadlines and Notifications

## Purpose

Track job/milestone deadlines, reminder scheduling, overdue state, notification feeds, and deadline audit history.

## Current Status

Implemented with a Convex cron that scans every 15 minutes. This is the repository’s current scheduled/background behavior; it is not a general chain synchronization scheduler.

## Primary Locations

- `packages/backend/convex/deadlines/{schema,queries,mutations,helpers}.ts`
- `packages/backend/convex/crons.ts`
- `apps/web/features/deadlines/`

## Responsibilities

- Set/update job and milestone deadlines with audit events.
- Create reminder rows for 24-hour, 6-hour, 1-hour, and overdue thresholds.
- Mark reminders sent/skipped/failed and create notification records.
- Compute deadline status alongside workflow/escrow status.
- Expose upcoming/overdue work and unread notification counts.

## Main Entry Points

User mutations: `setMicroGigDeadline`, `setMilestoneDeadline`, `updateDeadline`, `markNotificationRead`, `markAllNotificationsRead`. Internal functions include `scanUpcomingDeadlines`, `markOverdueDeadlines`, reminder creation/sending, and reconciliation. Queries list deadlines/reminders/notifications by parent or wallet.

## Data Model

`deadlineReminders` is a queue/status record with schedule and recipients. `notifications` is a wallet-scoped feed. `deadlineAuditEvents` records old/new deadline and actor metadata. Jobs and milestones retain derived deadline status/reminder state.

## External Dependencies

Convex cron scheduler and optional Resend/email integration where configured.

## Internal Dependencies

Jobs, milestones, escrows, revisions, disputes, cancellations, agreements, and conversations.

## Important Flows

```text
deadline set/update → audit row + reminder upsert
cron every 15 min → scan due reminders/overdue parents → notification + reminder status
workflow transition → recompute deadline status and reminder set
```

## Common Change Locations

Use `deadlines/helpers.ts` for status calculation and parent resolution; `deadlines/mutations.ts` for scheduled side effects; `crons.ts` for cadence.

## Risks / Gotchas

- A cron cadence does not imply every product event is automatically reconciled.
- Reminder scanning and on-chain sync are separate systems.
- Parent type is limited to `micro_gig` and `milestone` in deadline tables.

## Related Notes

[[backend/Sync and Scheduled Jobs]], [[data/State Machines]], [[modules/Disputes and Cancellations]]
