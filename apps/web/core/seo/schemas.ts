import { z } from "zod";

const MAX_SEO_TEXT_LENGTH = 280;
const DEFAULT_SITE_URL = "http://localhost:3000";

export const TSeoTextSchema = z
  .string()
  .trim()
  .transform((value) =>
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/\p{Cc}/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_SEO_TEXT_LENGTH),
  );

export const TWalletAddressParamSchema = z
  .string()
  .trim()
  .transform((value) => decodeURIComponent(value))
  .pipe(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[CG][A-Z2-7]{55}$/),
  );

export const TConvexIdParamSchema = z
  .string()
  .trim()
  .transform((value) => decodeURIComponent(value))
  .pipe(
    z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
  );

export const TEscrowIdParamSchema = z
  .string()
  .trim()
  .transform((value) => decodeURIComponent(value))
  .pipe(
    z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9:_-]+$/),
  );

export function sanitizeSeoText(value: string | null | undefined, fallback: string): string {
  const parsedValue = TSeoTextSchema.safeParse(value ?? "");

  if (!parsedValue.success || parsedValue.data.length === 0) {
    return fallback;
  }

  return parsedValue.data;
}

export function parseWalletAddressParam(value: string): string | null {
  const result = TWalletAddressParamSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseConvexIdParam(value: string): string | null {
  const result = TConvexIdParamSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseEscrowIdParam(value: string): string | null {
  const result = TEscrowIdParamSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function normalizeSiteUrl(rawDomain: string | undefined, nodeEnv: string): URL {
  const trimmedDomain = rawDomain?.trim();
  const candidateDomain =
    trimmedDomain && trimmedDomain.length > 0 ? trimmedDomain : DEFAULT_SITE_URL;
  const urlCandidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(candidateDomain)
    ? candidateDomain
    : `${nodeEnv === "production" ? "https" : "http"}://${candidateDomain}`;
  const parsedUrl = z.url().safeParse(urlCandidate);

  if (!parsedUrl.success) {
    return new URL(DEFAULT_SITE_URL);
  }

  const url = new URL(parsedUrl.data);
  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url;
}

export function normalizeCanonicalPath(path: string): string {
  const trimmedPath = path.trim();

  if (!trimmedPath || trimmedPath === "/") {
    return "/";
  }

  const parsedUrl = new URL(
    trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`,
    DEFAULT_SITE_URL,
  );
  const normalizedPath = parsedUrl.pathname.replace(/\/{2,}/g, "/");

  return normalizedPath === "" ? "/" : normalizedPath;
}
