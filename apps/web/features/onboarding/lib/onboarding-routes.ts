export const ONBOARDING_ROUTE = "/onboarding";

const LANDING_PAGE_V2_ROUTES = new Set(["/", "/home"]);

export function isOnboardingExemptRoute(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  return pathname === ONBOARDING_ROUTE || LANDING_PAGE_V2_ROUTES.has(pathname);
}

export function buildOnboardingRedirectPath(pathname: string | null, search: string): string {
  const nextPath = `${pathname || "/"}${search ? `?${search}` : ""}`;
  return `${ONBOARDING_ROUTE}?next=${encodeURIComponent(nextPath)}`;
}
