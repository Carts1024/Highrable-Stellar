import type {
  IAdminDashboardMetrics,
  IAdminDisputeDetail,
  IAdminDisputesResponse,
  IAdminSessionResponse,
  TAdminResolutionRequest,
  TAdminReviewStatus,
} from "@/features/admin/types";

export interface IAdminApiRequestOptions {
  readonly signal?: AbortSignal;
}

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

async function readJsonOrThrow<TResponse>(response: Response): Promise<TResponse> {
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

  if (!payload) {
    throw new AdminApiError(response.status, "Admin API returned an invalid JSON response.");
  }

  return payload as TResponse;
}

export async function fetchAdminSession(
  options: IAdminApiRequestOptions = {},
): Promise<IAdminSessionResponse> {
  const response = await fetch("/api/admin/session", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });

  return await readJsonOrThrow<IAdminSessionResponse>(response);
}

export async function fetchAdminMetrics(
  options: IAdminApiRequestOptions = {},
): Promise<IAdminDashboardMetrics> {
  const response = await fetch("/api/admin/metrics", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });

  return await readJsonOrThrow<IAdminDashboardMetrics>(response);
}

export async function fetchAdminDisputes(
  params?: {
    status?: string;
    onChainStatus?: string;
    limit?: number;
  },
  options: IAdminApiRequestOptions = {},
): Promise<IAdminDisputesResponse> {
  const response = await fetch(
    `/api/admin/disputes${buildAdminQuery({
      status: params?.status,
      onChainStatus: params?.onChainStatus,
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

export async function fetchAdminDispute(
  disputeId: string,
  options: IAdminApiRequestOptions = {},
): Promise<IAdminDisputeDetail> {
  const response = await fetch(`/api/admin/disputes/${encodeURIComponent(disputeId)}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal: options.signal,
  });

  return await readJsonOrThrow<IAdminDisputeDetail>(response);
}

export async function postAdminModeratorNote(disputeId: string, message: string): Promise<void> {
  const response = await fetch(`/api/admin/disputes/${encodeURIComponent(disputeId)}/note`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  await readJsonOrThrow<{ success: true }>(response);
}

export async function postAdminReviewStatus(
  disputeId: string,
  status: TAdminReviewStatus,
  message?: string,
): Promise<void> {
  const response = await fetch(`/api/admin/disputes/${encodeURIComponent(disputeId)}/status`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status,
      ...(message ? { message } : {}),
    }),
  });

  await readJsonOrThrow<{ success: true }>(response);
}

export async function postAdminResolution(
  disputeId: string,
  payload: TAdminResolutionRequest,
): Promise<void> {
  const response = await fetch(`/api/admin/disputes/${encodeURIComponent(disputeId)}/resolve`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  await readJsonOrThrow<{ success: true }>(response);
}
