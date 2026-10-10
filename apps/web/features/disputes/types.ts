import { api } from "@repo/convex-client";

import type { TConvexDoc } from "@repo/convex-client";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

export type TDisputeReasonCategory = TConvexDoc<"disputes">["reasonCategory"];
export type TDisputeParentType = TConvexDoc<"disputes">["parentType"];
export type TDisputeStatus = TConvexDoc<"disputes">["status"];
export type TDisputeOnChainStatus = TConvexDoc<"disputes">["onChainStatus"];
export type TDisputeActorRole = TConvexDoc<"disputeEvents">["actorRole"];
export type TDisputeActorWalletType = TConvexDoc<"disputeEvents">["actorWalletType"];

export type TParticipantDisputeListQueryResult = FunctionReturnType<
  typeof api.disputes.getDisputesForWallet
>;
export type TParticipantDisputeQueryResult = FunctionReturnType<typeof api.disputes.getDispute>;
export type TParticipantDisputeByParentQueryResult = FunctionReturnType<
  typeof api.disputes.getDisputeByParent
>;
export type TParticipantActiveDisputeForEscrowQueryResult = FunctionReturnType<
  typeof api.disputes.getActiveDisputeForEscrow
>;
export type TParticipantDisputeTimelineQueryResult = FunctionReturnType<
  typeof api.disputes.getDisputeTimeline
>;
export type TParticipantDisputeEvidenceQueryResult = FunctionReturnType<
  typeof api.disputes.getDisputeEvidence
>;
export type TParticipantDisputeContextQueryResult = FunctionReturnType<
  typeof api.disputes.getDisputeContextByParent
>;
export type TParticipantAgreementContextQueryResult = FunctionReturnType<
  typeof api.work_agreements.getAgreementContextForDispute
>;
export type TParticipantLatestSubmissionQueryResult = FunctionReturnType<
  typeof api.work_submissions.getLatestSubmissionForEscrow
>;
export type TParticipantRevisionRequestsQueryResult = FunctionReturnType<
  typeof api.revisions.getRevisionRequestsByParent
>;
export type TParticipantDisputeEligibilityQueryResult = FunctionReturnType<
  typeof api.disputes.canOpenDispute
>;
export type TParticipantDisputePermissionQueryResult = FunctionReturnType<
  typeof api.disputes.canViewDispute
>;
export type TParticipantDisputeResponsePermissionQueryResult = FunctionReturnType<
  typeof api.disputes.canRespondToDispute
>;

export type TParticipantCreateDisputeArgs = FunctionArgs<typeof api.disputes.createDispute>;
export type TParticipantAddDisputeEvidenceArgs = FunctionArgs<
  typeof api.disputes.addDisputeEvidence
>;
export type TParticipantAddDisputeResponseArgs = FunctionArgs<
  typeof api.disputes.addDisputeResponse
>;
export type TParticipantMarkDisputeStartedArgs = FunctionArgs<
  typeof api.disputes.markDisputeOnChainStarted
>;
export type TParticipantMarkDisputeSucceededArgs = FunctionArgs<
  typeof api.disputes.markDisputeOnChainSucceeded
>;
export type TParticipantMarkDisputeFailedArgs = FunctionArgs<
  typeof api.disputes.markDisputeOnChainFailed
>;
