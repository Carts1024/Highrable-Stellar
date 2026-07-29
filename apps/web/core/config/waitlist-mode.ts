export type TWaitlistRouteDecision = "allow" | "redirect";

interface IWaitlistRouteInput {
  readonly waitlistMode: boolean;
  readonly pathname: string;
}

const WAITLIST_MARKETING_PATHS = new Set(["/", "/home"]);
const PUBLIC_METADATA_PATHS = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
]);

/** Resolves the launch flag fail-closed: only an explicit false opens the full app. */
export function resolveWaitlistMode(value: unknown): boolean {
  return typeof value !== "string" || value.trim().toLowerCase() !== "false";
}

function normalizePathname(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/u, "") || "/";
}

function isInfrastructurePath(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname);

  return (
    normalizedPathname === "/api" ||
    normalizedPathname.startsWith("/api/") ||
    normalizedPathname === "/_next" ||
    normalizedPathname.startsWith("/_next/") ||
    PUBLIC_METADATA_PATHS.has(normalizedPathname) ||
    /\.[^/]+$/u.test(normalizedPathname)
  );
}

/** Returns whether a browser page belongs to the strict waitlist experience. */
export function isWaitlistPublicPath(pathname: string): boolean {
  return WAITLIST_MARKETING_PATHS.has(normalizePathname(pathname));
}

/** Classifies a request without coupling the policy to Next.js request objects. */
export function getWaitlistRouteDecision({
  waitlistMode,
  pathname,
}: IWaitlistRouteInput): TWaitlistRouteDecision {
  if (!waitlistMode || isWaitlistPublicPath(pathname) || isInfrastructurePath(pathname)) {
    return "allow";
  }

  return "redirect";
}
