import type { NextRequest } from "next/server";

export class SameOriginError extends Error {
  readonly status = 403;

  constructor() {
    super("Cross-origin authentication requests are not allowed.");
    this.name = "SameOriginError";
  }
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    throw new SameOriginError();
  }

  if (!origin && request.headers.get("sec-fetch-site") === "cross-site") {
    throw new SameOriginError();
  }
}
