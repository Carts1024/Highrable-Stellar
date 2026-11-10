import type { TConvexStorageId } from "@repo/convex-client";

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = (await response.json().catch(() => null)) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(result?.error ?? "Member request failed.");
  }
  return result;
}

export function saveProfileDraft<T extends Record<string, unknown>>(draft: T): Promise<{ userId: string }> {
  return postJson<{ userId: string }>("/api/member/onboarding/draft", draft);
}

export function completeOnboarding(): Promise<{ userId: string }> {
  return postJson<{ userId: string }>("/api/member/onboarding/complete").then((result) => {
    window.dispatchEvent(new Event("highrable-auth-session-refresh"));
    return result;
  });
}

export function updateFreelancerProfile<T extends Record<string, unknown>>(
  profile: T,
): Promise<{ profile: unknown }> {
  return postJson<{ profile: unknown }>("/api/member/profile/freelancer", profile).then((result) => {
    window.dispatchEvent(new Event("highrable-auth-session-refresh"));
    return result;
  });
}

export function updateClientProfile<T extends Record<string, unknown>>(
  profile: T,
): Promise<{ profile: unknown }> {
  return postJson<{ profile: unknown }>("/api/member/profile/client", profile).then((result) => {
    window.dispatchEvent(new Event("highrable-auth-session-refresh"));
    return result;
  });
}

export async function uploadAvatar(file: File): Promise<TConvexStorageId> {
  const issued = await postJson<{
    uploadToken: string;
    uploadUrl: string;
  }>("/api/member/avatar/upload-url", {
    name: file.name,
    size: file.size,
    mimeType: file.type,
  });
  const uploadResponse = await fetch(issued.uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("Avatar upload failed.");
  }
  const uploaded = (await uploadResponse.json().catch(() => null)) as {
    storageId?: TConvexStorageId;
  } | null;
  if (!uploaded?.storageId) {
    throw new Error("Avatar upload returned no storage ID.");
  }
  const finalized = await postJson<{ storageId: TConvexStorageId }>("/api/member/avatar/finalize", {
    uploadToken: issued.uploadToken,
    storageId: uploaded.storageId,
  });
  return finalized.storageId;
}
