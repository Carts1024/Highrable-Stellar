import { TStellarPublicKeySchema } from "@/core/wallet/validation";
import { z } from "zod";

import type {
  IAdminDashboardMetrics,
  IAdminDisputeDetail,
  IAdminDisputesResponse,
  IAdminMembershipManagement,
  IAdminMembershipOperationRequest,
  IAdminMembershipOperationResponse,
  IAdminResolutionFailedResponse,
  IAdminResolutionSignedResponse,
  IAdminResolutionStartedResponse,
  IAdminSessionResponse,
  TAdminResolutionOutcomeResponse,
  TAdminResolutionRequest,
  TAdminResolutionResponse,
  TAdminReviewStatus,
} from "@/features/admin/types";
import type { TDisputeOnChainStatus, TDisputeStatus } from "@/features/disputes/types";

export interface IAdminApiRequestOptions {
  readonly signal?: AbortSignal;
}

export type TAdminAssignmentFilter = "unassigned" | "mine" | "all";

export class AdminApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.details = details;
  }
}

export function isAdminApiError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError;
}

export function isAdminAccessError(error: unknown): error is AdminApiError {
  return isAdminApiError(error) && (error.status === 401 || error.status === 403);
}

export function isAdminNotFoundError(error: unknown): error is AdminApiError {
  return isAdminApiError(error) && error.status === 404;
}

export function isAdminNetworkError(error: unknown): error is AdminApiError {
  return isAdminApiError(error) && error.status === 0;
}

export function getAdminApiErrorMessage(error: AdminApiError): string {
  return error.message;
}

export function isRetryableAdminReadError(error: unknown): boolean {
  return isAdminNetworkError(error) || (isAdminApiError(error) && error.status >= 500);
}

export function shouldRetryAdminRead(failureCount: number, error: unknown): boolean {
  return isRetryableAdminReadError(error) && failureCount < 2;
}

const AdminSessionResponseSchema = z
  .object({
    adminWallet: TStellarPublicKeySchema,
    isOwner: z.boolean(),
    isDisputeAdmin: z.boolean(),
  })
  .passthrough();

const INVALID_ADMIN_SESSION_RESPONSE_MESSAGE = "Admin API returned an invalid session response.";

function buildAdminQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    search.set(key, String(value));
  }

  const query = search.toString();
  return query.length > 0 ? `?${query}` : "";
}

function getErrorPayloadMessage(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) {
    return undefined;
  }

  const message = payload.error;
  return typeof message === "string" && message.trim().length > 0 ? message : undefined;
}

function getErrorPayloadDetails(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null || !("details" in payload)) {
    return undefined;
  }

  return payload.details;
}

async function readJsonOrThrow<TResponse>(
  response: Response,
  options: { readonly allowEmptyPayload?: boolean } = {},
): Promise<TResponse> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new AdminApiError(
      response.status,
      `Admin API returned ${response.status} ${response.statusText || "non-JSON response"}. Restart the web server and retry.`,
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const fallbackMessage = `Admin API request failed with status ${response.status}.`;
    throw new AdminApiError(
      response.status,
      getErrorPayloadMessage(payload) ?? fallbackMessage,
      getErrorPayloadDetails(payload),
    );
  }

  if (!options.allowEmptyPayload && !payload) {
    throw new AdminApiError(response.status, "Admin API returned an invalid JSON response.");
  }

  return payload as TResponse;
}

function normalizeAdminRequestError(error: unknown): AdminApiError {
  if (isAdminApiError(error)) {
    return error;
  }

  return new AdminApiError(
    0,
    "Could not reach the admin API. Check your connection and retry.",
    error,
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchAdminResponse(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw normalizeAdminRequestError(error);
  }
}

export async function fetchAdminSession(
  options: IAdminApiRequestOptions = {},
): Promise<IAdminSessionResponse> {
  const response = await fetchAdminResponse("/api/admin/session", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });

  const payload = await readJsonOrThrow<unknown>(response, { allowEmptyPayload: true });
  const parsed = AdminSessionResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AdminApiError(response.status, INVALID_ADMIN_SESSION_RESPONSE_MESSAGE);
  }

  return parsed.data;
}

export async function fetchAdminMetrics(
  options: IAdminApiRequestOptions = {},
): Promise<IAdminDashboardMetrics> {
  const response = await fetchAdminResponse("/api/admin/metrics", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });

  return await readJsonOrThrow<IAdminDashboardMetrics>(response);
}

export async function fetchAdminMembershipManagement(
  options: IAdminApiRequestOptions = {},
): Promise<IAdminMembershipManagement> {
  const response = await fetchAdminResponse("/api/admin/admins", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });
  return await readJsonOrThrow<IAdminMembershipManagement>(response);
}

export async function startAdminMembershipOperation(
  input: IAdminMembershipOperationRequest,
): Promise<IAdminMembershipOperationResponse> {
  const response = await fetchAdminResponse("/api/admin/admins", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return await readJsonOrThrow<IAdminMembershipOperationResponse>(response);
}

export async function recordAdminMembershipSignedTransaction(
  operationId: string,
  transactionHash: string,
  transactionValidUntil: number,
): Promise<IAdminMembershipOperationResponse> {
  const response = await fetchAdminResponse(
    `/api/admin/admins/${encodeURIComponent(operationId)}/signed`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionHash, transactionValidUntil }),
    },
  );
  return await readJsonOrThrow<IAdminMembershipOperationResponse>(response);
}

export async function recoverAdminMembershipOperation(
  operationId: string,
): Promise<IAdminMembershipOperationResponse & { readonly status?: "pending" }> {
  const response = await fetchAdminResponse(
    `/api/admin/admins/${encodeURIComponent(operationId)}/recover`,
    { method: "POST", credentials: "include" },
  );
  return await readJsonOrThrow<IAdminMembershipOperationResponse & { status?: "pending" }>(
    response,
  );
}

export async function failAdminMembershipOperationBeforeSubmission(
  operationId: string,
  errorMessage: string,
): Promise<IAdminMembershipOperationResponse> {
  const response = await fetchAdminResponse(
    `/api/admin/admins/${encodeURIComponent(operationId)}/fail`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ errorMessage }),
    },
  );
  return await readJsonOrThrow<IAdminMembershipOperationResponse>(response);
}

export async function fetchAdminDisputes(
  params?: {
    status?: TDisputeStatus;
    onChainStatus?: TDisputeOnChainStatus;
    assignmentFilter?: TAdminAssignmentFilter;
    limit?: number;
  },
  options: IAdminApiRequestOptions = {},
): Promise<IAdminDisputesResponse> {
  const response = await fetchAdminResponse(
    `/api/admin/disputes${buildAdminQuery({
      status: params?.status,
      onChainStatus: params?.onChainStatus,
      assignmentFilter: params?.assignmentFilter,
      limit: params?.limit,
    })}`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: options.signal,
    },
  );

  return await readJsonOrThrow<IAdminDisputesResponse>(response);
}

export async function postAdminClaimDispute(disputeId: string): Promise<void> {
  const response = await fetchAdminResponse(
    `/api/admin/disputes/${encodeURIComponent(disputeId)}/claim`,
    { method: "POST", credentials: "include" },
  );
  await readJsonOrThrow<{ assignedAdminWallet: string }>(response);
}

export async function postAdminAssignDispute(
  disputeId: string,
  assignedAdminWallet: string | null,
): Promise<void> {
  const response = await fetchAdminResponse(
    `/api/admin/disputes/${encodeURIComponent(disputeId)}/assignment`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignedAdminWallet }),
    },
  );
  await readJsonOrThrow<{ assignedAdminWallet: string | null }>(response);
}

export async function fetchAdminDispute(
  disputeId: string,
  options: IAdminApiRequestOptions = {},
): Promise<IAdminDisputeDetail> {
  const response = await fetchAdminResponse(
    `/api/admin/disputes/${encodeURIComponent(disputeId)}`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: options.signal,
    },
  );

  return await readJsonOrThrow<IAdminDisputeDetail>(response);
}

export async function postAdminModeratorNote(disputeId: string, message: string): Promise<void> {
  const response = await fetchAdminResponse(
    `/api/admin/disputes/${encodeURIComponent(disputeId)}/note`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ message }),
    },
  );

  await readJsonOrThrow<{ success: true }>(response);
}

export async function postAdminReviewStatus(
  disputeId: string,
  status: TAdminReviewStatus,
  message?: string,
): Promise<void> {
  const response = await fetchAdminResponse(
    `/api/admin/disputes/${encodeURIComponent(disputeId)}/status`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status,
        ...(message ? { message } : {}),
      }),
    },
  );

  await readJsonOrThrow<{ success: true }>(response);
}

export async function postAdminResolution(
  disputeId: string,
  payload: TAdminResolutionRequest,
): Promise<TAdminResolutionResponse> {
  const response = await fetchAdminResponse(
    `/api/admin/disputes/${encodeURIComponent(disputeId)}/resolve`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await readJsonOrThrow<unknown>(response);
  if (payload.phase === "started") {
    if (isAdminResolutionStartedResponse(result)) {
      try {
        assertStartedResolutionAcknowledgment(result, payload);
        return result;
      } catch {
        throw new AdminApiError(
          response.status,
          "Admin API returned an invalid or mismatched settlement start acknowledgment.",
          result,
        );
      }
    }

    throw new AdminApiError(
      response.status,
      "Admin API returned an invalid or mismatched settlement start acknowledgment.",
      result,
    );
  }
  if (payload.phase === "signed") {
    if (isAdminResolutionSignedResponse(result)) {
      try {
        assertSignedResolutionAcknowledgment(result, payload);
        return result;
      } catch {
        throw new AdminApiError(
          response.status,
          "Admin API returned an invalid or mismatched signed settlement acknowledgment.",
          result,
        );
      }
    }

    throw new AdminApiError(
      response.status,
      "Admin API returned an invalid or mismatched signed settlement acknowledgment.",
      result,
    );
  }
  if (payload.phase === "failed" && isAdminResolutionFailedResponse(result)) {
    return result;
  }
  if (
    (payload.phase === "reconcile" || payload.phase === "succeeded") &&
    isAdminResolutionOutcome(result)
  ) {
    return result;
  }

  throw new AdminApiError(
    response.status,
    "Admin API returned an unrecognized settlement outcome.",
    result,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasResult(value: Record<string, unknown>): boolean {
  return "result" in value;
}

function isAdminResolutionStartedResponse(
  value: unknown,
): value is IAdminResolutionStartedResponse {
  return isRecord(value) && value.success === true && value.phase === "started" && hasResult(value);
}

function isAdminResolutionSignedResponse(value: unknown): value is IAdminResolutionSignedResponse {
  return isRecord(value) && value.success === true && value.phase === "signed" && hasResult(value);
}

function isAdminResolutionFailedResponse(value: unknown): value is IAdminResolutionFailedResponse {
  return isRecord(value) && value.success === true && value.phase === "failed" && hasResult(value);
}

function isAdminResolutionOutcome(value: unknown): value is TAdminResolutionOutcomeResponse {
  return (
    isRecord(value) &&
    (value.status === "pending" || value.status === "succeeded" || value.status === "failed") &&
    hasResult(value)
  );
}

function normalizeTransactionHash(transactionHash: string): string {
  return transactionHash.trim().toLowerCase();
}

function assertStartedResolutionAcknowledgment(
  response: IAdminResolutionStartedResponse,
  request: Extract<TAdminResolutionRequest, { phase: "started" }>,
): void {
  const result = response.result;
  if (
    !isRecord(result) ||
    typeof result.operationId !== "string" ||
    result.operationId !== request.operationId ||
    typeof result.freelancerShareBps !== "number" ||
    !Number.isFinite(result.freelancerShareBps) ||
    !Number.isSafeInteger(result.freelancerShareBps) ||
    result.freelancerShareBps !== request.freelancerShareBps
  ) {
    throw new Error("Settlement start acknowledgment does not match the request.");
  }
}

function assertSignedResolutionAcknowledgment(
  response: IAdminResolutionSignedResponse,
  request: Extract<TAdminResolutionRequest, { phase: "signed" }>,
): void {
  const result = response.result;
  if (
    !isRecord(result) ||
    typeof result.operationId !== "string" ||
    result.operationId !== request.operationId ||
    typeof result.transactionHash !== "string"
  ) {
    throw new Error("Signed settlement acknowledgment does not match the request.");
  }

  const requestedHash = normalizeTransactionHash(request.transactionHash);
  const acknowledgedHash = normalizeTransactionHash(result.transactionHash);
  if (
    requestedHash.length === 0 ||
    acknowledgedHash.length === 0 ||
    acknowledgedHash !== requestedHash
  ) {
    throw new Error("Signed settlement acknowledgment does not match the request.");
  }
}
