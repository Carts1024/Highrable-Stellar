import { api } from "@repo/backend/convex/_generated/api";
import { ConvexReactClient } from "convex/react";

import type { Doc, Id, TableNames } from "@repo/backend/convex/_generated/dataModel";

const DEFAULT_CONVEX_URL = "http://127.0.0.1:3210";

let cachedClient: ConvexReactClient | null = null;

export type TConvexTableName = TableNames;
export type TConvexDoc<TTableName extends TConvexTableName> = Doc<TTableName>;
export type TConvexId<TTableName extends TConvexTableName> = Id<TTableName>;
export type TConvexStorageId = Id<"_storage">;

export function resolveConvexUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();

  if (!configuredUrl) {
    return DEFAULT_CONVEX_URL;
  }

  return configuredUrl;
}

export function getConvexClient(): ConvexReactClient {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new ConvexReactClient(resolveConvexUrl());
  return cachedClient;
}

export { api };
