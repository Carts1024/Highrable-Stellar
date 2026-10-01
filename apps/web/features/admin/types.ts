import { api } from "@repo/convex-client";

import type { FunctionArgs, FunctionReturnType } from "convex/server";

export type TAdminDisputeQueueQueryResult = FunctionReturnType<typeof api.admin.listAdminDisputes>;
export type TAdminDisputeDetailQueryResult = FunctionReturnType<typeof api.admin.getAdminDispute>;
export type TAdminReviewStatus = FunctionArgs<typeof api.admin.changeDisputeReviewStatus>["status"];
export type TAdminResolutionStatus = FunctionArgs<
  typeof api.admin.recordDisputeResolutionStarted
>["status"];
export type TAdminResolutionStartedResult = FunctionReturnType<
  typeof api.admin.recordDisputeResolutionStarted
>;
export type TAdminResolutionSignedResult = FunctionReturnType<
  typeof api.admin.recordDisputeResolutionSigned
>;
export type TAdminResolutionFailedResult = FunctionReturnType<
  typeof api.admin.recordDisputeResolutionFailed
>;
export type TAdminResolutionSubmissionUnknownResult = FunctionReturnType<
  typeof api.admin.recordDisputeResolutionSubmissionUnknown
>;
export type TAdminResolutionSucceededResult = FunctionReturnType<
  typeof api.admin.recordDisputeResolutionSucceeded
>;

export type IAdminDisputeListItem = TAdminDisputeQueueQueryResult[number];
export type IAdminDashboardMetrics = FunctionReturnType<typeof api.admin.getAdminDashboardMetrics>;
export type IAdminDisputeDetail = TAdminDisputeDetailQueryResult;
export type IAdminMembershipManagement = FunctionReturnType<typeof api.admin.listDisputeAdmins>;
export type IAdminMembershipOperation = IAdminMembershipManagement["operations"][number];

export interface IAdminDisputesResponse {
  readonly disputes: TAdminDisputeQueueQueryResult;
}

export interface IAdminSessionResponse {
  readonly adminWallet: string;
  readonly isOwner: boolean;
  readonly isDisputeAdmin: boolean;
}

export interface IAdminMembershipOperationResponse {
  readonly operation: IAdminMembershipOperation;
}

export interface IAdminMembershipOperationRequest {
  readonly wallet: string;
  readonly action: "grant" | "revoke";
  readonly operationId: string;
}

export interface IAdminResolutionRequestStarted {
  readonly phase: "started";
  readonly status: TAdminResolutionStatus;
  readonly freelancerShareBps: number;
  readonly operationId: string;
  readonly resolutionNote?: string;
}

export interface IAdminResolutionRequestSigned {
  readonly phase: "signed";
  readonly operationId: string;
  readonly transactionHash: string;
  readonly transactionValidUntil: number;
}

export interface IAdminResolutionRequestSucceeded {
  readonly phase: "succeeded";
  readonly operationId: string;
}

export interface IAdminResolutionRequestFailed {
  readonly phase: "failed";
  readonly operationId: string;
  readonly errorMessage: string;
}

export interface IAdminResolutionRequestReconcile {
  readonly phase: "reconcile" | "succeeded";
  readonly operationId: string;
}

export type TAdminResolutionRequest =
  | IAdminResolutionRequestStarted
  | IAdminResolutionRequestSigned
  | IAdminResolutionRequestSucceeded
  | IAdminResolutionRequestFailed
  | IAdminResolutionRequestReconcile;

export interface IAdminResolutionStartedResponse {
  readonly success: true;
  readonly phase: "started";
  readonly result: TAdminResolutionStartedResult;
}

export interface IAdminResolutionSignedResponse {
  readonly success: true;
  readonly phase: "signed";
  readonly result: TAdminResolutionSignedResult;
}

export interface IAdminResolutionFailedResponse {
  readonly success: true;
  readonly phase: "failed";
  readonly result: TAdminResolutionFailedResult;
}

export interface IAdminResolutionPendingResponse {
  readonly status: "pending";
  readonly result: TAdminResolutionSubmissionUnknownResult;
}

export interface IAdminResolutionSucceededResponse {
  readonly status: "succeeded";
  readonly result: TAdminResolutionSucceededResult;
}

export interface IAdminResolutionVerifiedFailedResponse {
  readonly status: "failed";
  readonly result: TAdminResolutionFailedResult;
}

export type TAdminResolutionOutcomeResponse =
  | IAdminResolutionPendingResponse
  | IAdminResolutionSucceededResponse
  | IAdminResolutionVerifiedFailedResponse;

export type TAdminResolutionResponse =
  | IAdminResolutionStartedResponse
  | IAdminResolutionSignedResponse
  | IAdminResolutionFailedResponse
  | TAdminResolutionOutcomeResponse;
