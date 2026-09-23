---
type: module
area: collaboration
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# Collaboration

## Purpose

Provide parent-linked conversations, messages, read tracking, attachments, protected previews/download policy, and access audit logs around jobs and delivery workflows.

## Current Status

Implemented in Convex and used by marketplace, submission, dispute, cancellation, and agreement surfaces. Attachment protection is a policy/deterrence layer; it is not a guarantee against screenshots or client-side capture.

## Primary Locations

- `packages/backend/convex/conversations/`
- `packages/backend/convex/attachments/`
- `apps/web/features/chat/`, `attachments/`
- `packages/ui/src/components/ui-customs/rich-text-*`

## Responsibilities

- Create/find conversations by parent (`job`, `milestone`, `escrow`, `work_submission`, `dispute`, or direct).
- Send user/system/event messages and maintain read/unread snapshots.
- Upload Convex storage files or create external links.
- Evaluate visibility, viewer roles, preview/download permissions, protection settings, and access logs.

## Main Entry Points

Convex conversation queries/mutations include `getOrCreateConversationForParent`, `sendMessage`, `markConversationRead`, and message/participant queries. Attachment functions include upload URL generation, save/create external attachment, attach/soft-delete, protection updates, protected preview logging, download attempts, and access logging.

## Data Model

`conversations` points to parent IDs and participant wallets. `messages` stores body, sender role/type, event type/payload, and attachment IDs. `conversationReads` stores per-wallet read state. `attachments` stores storage/external URL, parent, visibility, status, protection mode, allowed viewer roles, and timestamps. `attachmentAccessLogs` stores action/result/reason metadata.

## External Dependencies

Convex file storage, external URLs, browser viewer, and optional notification/email side effects.

## Internal Dependencies

Jobs, escrow, proof, disputes, cancellations, agreements, deadlines, and users.

## Important Flows

```text
parent context → conversation → message + attachment IDs
viewer request → policy check → preview/download decision → access log
workflow mutation → system message + notification + timeline event
```

## Common Change Locations

Use attachment helpers for policy/role rules and conversation helpers for participant membership. Keep storage IDs and external URLs distinct. Update schema validators when adding an event type.

## Risks / Gotchas

- `metadata` fields use `v.any()` in several tables; validate untrusted structured values in helpers.
- Protected previews/logs improve auditability but do not establish cryptographic privacy.
- Parent IDs are polymorphic strings; preserve `parentType` when querying or mutating.

## Related Notes

[[modules/Work Submissions and Proof]], [[modules/Disputes and Cancellations]], [[modules/Deadlines and Notifications]]
