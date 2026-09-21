---
type: reference
area: data
status: current
last_updated: 2026-09-21
source_of_truth: repository
---

# State Machines

## Soroban escrow

The contract enum is `Created`, `Funded`, `Submitted`, `Released`, `Cancelled`, `Disputed`.

| Transition | Required current status | Authorized actor |
| --- | --- | --- |
| create direct/open | new ID | client |
| create and fund open | new ID | client; transfers funds immediately |
| fund | `Created` | escrow client; transfers client → contract |
| assign freelancer | `Created` or `Funded`, no freelancer yet | escrow client |
| submit work | `Funded` | assigned freelancer; stores proof hash |
| approve/release | `Submitted` | escrow client; transfers contract → freelancer and records reputation |
| cancel | `Created` or `Funded` | escrow client; funded cancellation refunds client |
| mark disputed | `Funded` or `Submitted` | client, assigned freelancer, or platform admin |
| resolve dispute | `Disputed` | platform admin; split basis points and transfers contract funds |

`resolve_dispute` maps a zero freelancer share to `Cancelled`; any positive share maps to `Released`. It does not store the provided resolution hash or record reputation.

## Convex job/escrow mirror

Convex uses lowercase equivalents: `created`, `funded`, `submitted`, `released`, `cancelled`, `disputed`. Escrow helpers rank `created < funded < submitted < released`; cancelled/disputed are terminal for safe sync purposes. Job mapping generally maps funded/submitted/released/cancelled/disputed to the corresponding job status (`released` becomes `completed`).

## Work agreements

`draft → pending_preview/ready_to_send → pending_acceptance → accepted → locked` with rejection/cancellation/superseded branches. Amendments use new versions rather than mutating immutable locked content.

## Work submissions

`draft → submitted_for_review → accepted_for_final/submitted → anchoring → anchored`, with `revision_requested → revision_submitted` and `anchor_failed → retry` branches. Submitted/anchored records become read-only under helper guards.

## Disputes

Convex review statuses are `open`, `under_review`, `awaiting_client_response`, `awaiting_freelancer_response`, `resolved_client`, `resolved_freelancer`, `split_resolution`, and `cancelled`. On-chain tracking is separate: `not_marked → marking → marked` or `mark_failed` (retryable).

## Cancellations

Requests track `draft`, `pending_freelancer_response`, `approved_for_cancel`, `rejected_by_freelancer`, `cancel_pending_on_chain`, `cancelled_on_chain`, `cancel_failed`, `blocked`, `expired`, and `withdrawn`. On-chain state is `not_required`, `not_submitted`, `pending`, `confirmed`, or `failed`.

## Deadlines and revisions

Deadline status is derived (`upcoming`, `due_soon`, `due_very_soon`, `overdue`, submitted/completed on-time/late, released, cancelled, disputed). Revision requests move through `requested`, `acknowledged`, `revision_submitted`, `accepted`, `cancelled`, or `expired`.

See [[contracts/Escrow Contract]], [[modules/Disputes and Cancellations]], and [[backend/Sync and Scheduled Jobs]].
