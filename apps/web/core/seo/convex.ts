import { env } from "@/core/config/env";
import { ConvexHttpClient } from "convex/browser";

import type { Doc, Id } from "../../../../packages/backend/convex/_generated/dataModel";

import { api } from "../../../../packages/backend/convex/_generated/api";

const DEFAULT_CONVEX_URL = "http://127.0.0.1:3210";

export type TSeoConvexDoc<TTableName extends keyof DocByTableName> = DocByTableName[TTableName];
export type TSeoConvexId<TTableName extends keyof DocByTableName> = Id<TTableName>;

type DocByTableName = {
  readonly jobs: Doc<"jobs">;
  readonly escrows: Doc<"escrows">;
};

function resolveSeoConvexUrl(): string {
  const configuredUrl = env.NEXT_PUBLIC_CONVEX_URL.trim();
  return configuredUrl.length > 0 ? configuredUrl : DEFAULT_CONVEX_URL;
}

export function createSeoConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(resolveSeoConvexUrl(), {
    logger: false,
    skipConvexDeploymentUrlCheck: env.NODE_ENV !== "production",
  });
}

export { api as seoApi };
