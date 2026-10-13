---
type: reference
area: data
status: current
last_updated: 2026-09-30
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
| resolve dispute | `Disputed` | authenticated platform owner or registered dispute admin, unless that actor is the escrow client or freelancer; split basis points and transfers contract funds |

`resolve_dispute` requires actor authorization and owner/registered-admin membership, then rejects either escrow participant as the settlement actor. A zero freelancer share maps to `Cancelled`; any positive share maps to `Released`. It does not store the provided resolution hash or record reputation.

## Convex job/escrow mirror

Convex uses lowercase equivalents: `created`, `funded`, `submitted`, `released`, `cancelled`, `disputed`. Escrow helpers rank `created < funded < submitted < released`; cancelled/disputed are terminal for safe sync purposes. Job mapping generally maps funded/submitted/released/cancelled/disputed to the corresponding job status (`released` becomes `completed`).

## Work agreements

`draft → pending_preview/ready_to_send → pending_acceptance → accepted → locked` with rejection/cancellation/superseded branches. Amendments use new versions rather than mutating immutable locked content.

## Work submissions

`draft → submitted_for_review → accepted_for_final/submitted → anchoring → anchored`, with `revision_requested → revision_submitted` and `anchor_failed → retry` branches. Submitted/anchored records become read-only under helper guards.

## Disputes

Convex review statuses are `open`, `under_review`, `awaiting_client_response`, `awaiting_freelancer_response`, `resolved_client`, `resolved_freelancer`, `split_resolution`, and `cancelled`. On-chain tracking is separate and callback-guarded:

| Callback | Current on-chain phase | Result |
| --- | --- | --- |
| started | `not_marked` | Enter `marking`; record one start event. |
| started | `mark_failed` without a hash | Enter `marking`; clear the current error and record one retry-start event. |
| started | `marking` | Return success without a write or duplicate event. |
| started | `mark_failed` with a hash or `marked` | Reject; confirmed data and known hashes stay unchanged. |
| succeeded | `marking` or `mark_failed` | Enter `marked` when the supplied hash does not conflict; clear the current error and run success side effects once. |
| succeeded | `marked` with the same hash | Return success without writes or side effects. |
| succeeded | `not_marked` or conflicting hash | Reject without writes. |
| failed | `marking` | Enter `mark_failed`, preserve any known hash, and run failure side effects once. |
| failed | `mark_failed` | Preserve the first failure; a supplied hash may fill an absent hash without repeating side effects. |
| failed | `marked` with no conflicting hash | Ignore the stale failure without changing confirmed data. |
| failed | `not_marked` or conflicting hash | Reject without writes. |

New starts and state-changing callbacks are rejected for terminal review statuses. Participant and configured-admin authorization, caller-supplied wallet limitations, original audit actors/wallet types, and historical failure events remain unchanged.

## Administrator settlement attempts

Settlement attempts are single-active per escrow and use `started → signed → submission_unknown → succeeded` or `failed` (with `submitted` retained for compatibility). A start requires an assigned, non-conflicted admin, a nonterminal dispute, and a disputed escrow. Resolution terms are exact integer basis points: client `0`, freelancer `10_000`, or split `1–9999`.

| Callback | Required current state | Result |
| --- | --- | --- |
| started | assigned admin; nonterminal dispute; disputed escrow; no other active attempt | Persist one attempt and pending transaction; matching active replay is a no-op; failed operation IDs cannot restart. |
| signed | initiating assigned admin; active attempt | Persist one 64-hex hash and positive safe expiry; matching replay preserves phase/timestamps/errors, including `submission_unknown`; conflicting identity or failed attempt rejects. |
| submission unknown | saved hash and expiry; active attempt | Keep attempt and transaction pending/locked; first uncertainty details win; duplicate callbacks and terminal attempts do not write. |
| succeeded | saved hash and expiry; server-verified exact settlement | Atomically map dispute/escrow/parent/transaction to terminal state and emit existing audit/notification effects once; authorized matching replay is harmless. |
| failed | active unsigned attempt, or saved hash with matching reconciliation hash | Preserve the first error and known hash; duplicate failures and nonconflicting stale failures after success do not write. |

The mapping is `0 → resolved_client/cancelled`, `10_000 → resolved_freelancer/released`, and intermediate shares → `split_resolution/released`. Optional legacy dispute contract/escrow references remain optional, but any populated conflicting reference is rejected. The UI/RPC verification layer and payment arithmetic are outside C17; payout bookkeeping still truncates whole units pending a token-precision follow-up.

Deliverable 2 C17 regression coverage now verifies these transitions against complete deterministic Convex snapshots. The 32 focused cases cover active-start identity and locking, signed/uncertain/failed phase boundaries, terminal and non-disputed replay guards, scoped authorization, both parent types, and single-write side effects. This extends the earlier C17 implementation evidence without changing the state vocabulary, public callback arguments, indexes, or schema.

## Cancellations

Requests track `draft`, `pending_freelancer_response`, `approved_for_cancel`, `rejected_by_freelancer`, `cancel_pending_on_chain`, `cancelled_on_chain`, `cancel_failed`, `blocked`, `expired`, and `withdrawn`. On-chain state is `not_required`, `not_submitted`, `pending`, `confirmed`, or `failed`.

## Deadlines and revisions

Deadline status is derived (`upcoming`, `due_soon`, `due_very_soon`, `overdue`, submitted/completed on-time/late, released, cancelled, disputed). Revision requests move through `requested`, `acknowledged`, `revision_submitted`, `accepted`, `cancelled`, or `expired`.

See [[contracts/Escrow Contract]], [[modules/Disputes and Cancellations]], and [[backend/Sync and Scheduled Jobs]].
