import { api } from "@repo/convex-client";

import type { FunctionArgs, FunctionReturnType } from "convex/server";

export type TAdminDisputeQueueQueryResult = FunctionReturnType<typeof api.admin.listAdminDisputes>;
export type TAdminDisputeDetailQueryResult = FunctionReturnType<typeof api.admin.getAdminDispute>;
export type TAdminReviewStatus = FunctionArgs<typeof api.admin.changeDisputeReviewStatus>["status"];
export type TAdminResolutionStatus = FunctionArgs<
  typeof api.admin.recordDisputeResolutionStarted
>["status"];

export type IAdminDisputeListItem = TAdminDisputeQueueQueryResult[number];
export type IAdminDashboardMetrics = FunctionReturnType<typeof api.admin.getAdminDashboardMetrics>;
export type IAdminDisputeDetail = TAdminDisputeDetailQueryResult;

export interface IAdminDisputesResponse {
  readonly disputes: TAdminDisputeQueueQueryResult;
}

export interface IAdminSessionResponse {
  readonly adminWallet: string;
}

export interface IAdminResolutionRequestStarted {
  readonly phase: "started";
  readonly status: TAdminResolutionStatus;
  readonly freelancerShareBps: number;
  readonly resolutionNote?: string;
}

export interface IAdminResolutionRequestSucceeded {
  readonly phase: "succeeded";
  readonly status: TAdminResolutionStatus;
  readonly freelancerShareBps: number;
  readonly transactionHash: string;
  readonly stellarExpertUrl?: string;
  readonly resolutionNote?: string;
}

export interface IAdminResolutionRequestFailed {
  readonly phase: "failed";
  readonly status: TAdminResolutionStatus;
  readonly freelancerShareBps: number;
  readonly errorMessage: string;
  readonly resolutionNote?: string;
}

export type TAdminResolutionRequest =
  | IAdminResolutionRequestStarted
  | IAdminResolutionRequestSucceeded
  | IAdminResolutionRequestFailed;
