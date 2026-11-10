import { env } from "@/core/config/env";

import type { NextRequest } from "next/server";

export class NewsfeedAccessError extends Error {
  readonly status: number;

  constructor(message: string, status = 404) {
    super(message);
    this.name = "NewsfeedAccessError";
    this.status = status;
  }
}

export function assertNewsfeedTextEnabled(): void {
  if (env.NEWSFEED_ENABLED !== true || env.NEWSFEED_TEXT_ENABLED !== true) {
    throw new NewsfeedAccessError("Newsfeed text is not available.");
  }
}

export function assertNewsfeedId(value: string, fieldName = "id"): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(normalized)) {
    throw new NewsfeedAccessError(`${fieldName} is invalid.`, 400);
  }
  return normalized;
}

export function getNewsfeedCursor(request: NextRequest): string | undefined {
  const cursor = request.nextUrl.searchParams.get("cursor")?.trim();
  if (!cursor) {
    return undefined;
  }
  if (cursor.length > 512) {
    throw new NewsfeedAccessError("cursor is invalid.", 400);
  }
  return cursor;
}

export function getNewsfeedCutoff(request: NextRequest): number | undefined {
  const raw = request.nextUrl.searchParams.get("cutoff");
  if (!raw) {
    return undefined;
  }
  const cutoff = Number(raw);
  if (!Number.isSafeInteger(cutoff) || cutoff <= 0) {
    throw new NewsfeedAccessError("cutoff is invalid.", 400);
  }
  return cutoff;
}
