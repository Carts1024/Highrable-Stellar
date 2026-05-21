import { TStellarPublicKeySchema } from "@/core/wallet/validation";

import type { TFriendbotResponse } from "@/core/wallet/types";

const FRIEND_BOT_BASE_URL = "https://friendbot.stellar.org";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getFriendbotErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }

  if (!isRecord(payload)) {
    return null;
  }

  const messageCandidate = payload.message;
  if (typeof messageCandidate === "string" && messageCandidate.trim().length > 0) {
    return messageCandidate.trim();
  }

  const detailCandidate = payload.detail;
  if (typeof detailCandidate === "string" && detailCandidate.trim().length > 0) {
    return detailCandidate.trim();
  }

  const extrasCandidate = payload.extras;
  if (isRecord(extrasCandidate)) {
    const extrasReason = extrasCandidate.reason;
    if (typeof extrasReason === "string" && extrasReason.trim().length > 0) {
      return extrasReason.trim();
    }
  }

  return null;
}

async function getFailedFriendbotMessage(response: Response): Promise<string> {
  const fallbackMessage = `Friendbot funding failed (${response.status}).`;

  try {
    const responseText = await response.text();
    if (!responseText.trim()) {
      return fallbackMessage;
    }

    try {
      const parsedPayload: unknown = JSON.parse(responseText);
      return getFriendbotErrorMessage(parsedPayload) ?? responseText.trim();
    } catch {
      return responseText.trim();
    }
  } catch {
    return fallbackMessage;
  }
}

export async function fundWithFriendbot(address: string): Promise<TFriendbotResponse> {
  const sanitizedAddress = TStellarPublicKeySchema.parse(address);

  let response: Response;

  try {
    response = await fetch(`${FRIEND_BOT_BASE_URL}?addr=${encodeURIComponent(sanitizedAddress)}`, {
      method: "GET",
      cache: "no-store",
    });
  } catch {
    throw new Error("Unable to reach Friendbot. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new Error(await getFailedFriendbotMessage(response));
  }

  try {
    const payload: unknown = await response.json();

    if (isRecord(payload)) {
      return payload;
    }

    return {
      result: payload,
    };
  } catch {
    throw new Error("Friendbot returned an unreadable response.");
  }
}
