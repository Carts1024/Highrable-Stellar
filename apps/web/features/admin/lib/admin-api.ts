import type {
  IAdminDashboardMetrics,
  IAdminDisputeDetail,
  IAdminDisputesResponse,
  TAdminResolutionRequest,
  TAdminReviewStatus,
} from "@/features/admin/types";

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

async function readJsonOrThrow<TResponse>(response: Response): Promise<TResponse> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Admin API returned ${response.status} ${response.statusText || "non-JSON response"}. Restart the web server and retry.`,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | ({ error?: string; details?: unknown } & TResponse)
    | null;

  if (!response.ok) {
    const fallbackMessage = `Admin API request failed with status ${response.status}.`;
    throw new Error(payload?.error ?? fallbackMessage);
  }

  if (!payload) {
    throw new Error("Admin API returned an invalid JSON response.");
  }

  return payload as TResponse;
}

export async function fetchAdminMetrics(): Promise<IAdminDashboardMetrics> {
  const response = await fetch("/api/admin/metrics", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  return await readJsonOrThrow<IAdminDashboardMetrics>(response);
}

export async function fetchAdminDisputes(params?: {
  status?: string;
  onChainStatus?: string;
  limit?: number;
}): Promise<IAdminDisputesResponse> {
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
    },
  );

  return await readJsonOrThrow<IAdminDisputesResponse>(response);
}

export async function fetchAdminDispute(disputeId: string): Promise<IAdminDisputeDetail> {
  const response = await fetch(`/api/admin/disputes/${encodeURIComponent(disputeId)}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
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
