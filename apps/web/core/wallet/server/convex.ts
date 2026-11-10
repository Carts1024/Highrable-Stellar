import { env } from "@/core/config/env";
import { ConvexHttpClient } from "convex/browser";

const DEFAULT_CONVEX_URL = "http://127.0.0.1:3210";

export function getMemberServiceSecret(): string {
  const secret = env.HIGHRABLE_AUTH_SERVICE_SECRET?.trim();
  if (!secret) {
    throw new Error("HIGHRABLE_AUTH_SERVICE_SECRET is not configured.");
  }
  return secret;
}

export function createMemberConvexClient(): ConvexHttpClient {
  const convexUrl = env.NEXT_PUBLIC_CONVEX_URL.trim() || DEFAULT_CONVEX_URL;
  return new ConvexHttpClient(convexUrl, {
    logger: false,
    skipConvexDeploymentUrlCheck: env.NODE_ENV !== "production",
  });
}
