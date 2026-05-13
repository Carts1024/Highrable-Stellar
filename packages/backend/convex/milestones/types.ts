import type { Doc, Id } from "../_generated/dataModel";
import type { TApplicationGateStatus } from "./schema";

export type TMilestoneId = Id<"milestones">;
export type TMilestoneDoc = Doc<"milestones">;

export type TMilestoneApplicationGateReason =
  | "first_milestone_open"
  | "previous_milestone_unfinished"
  | "waiting_client_decision"
  | "replacement_applications_open"
  | "continuation_offer_pending"
  | "continuation_offer_rejected"
  | "milestone_closed";

export type TMilestoneApplicationGate = {
  status: TApplicationGateStatus;
  canApply: boolean;
  reason: TMilestoneApplicationGateReason;
  message: string;
  previousMilestoneId?: TMilestoneId;
  previousFreelancerWallet?: string;
  continuationOfferFreelancerWallet?: string;
};
