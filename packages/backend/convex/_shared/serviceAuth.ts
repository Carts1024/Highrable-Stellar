import { ForbiddenError } from "./errors";

/**
 * Convex functions called by the Next.js server must carry a dedicated secret.
 * This is intentionally separate from the admin secret: possession of the
 * member-service credential grants only the narrow server gateway surface.
 */
export function assertMemberServiceSecret(secret: string): void {
  const configured = process.env.HIGHRABLE_AUTH_SERVICE_SECRET?.trim();
  if (!configured) {
    throw new ForbiddenError("Member service authentication is not configured.");
  }

  if (!secret || secret !== configured) {
    throw new ForbiddenError("Invalid member service authentication.");
  }
}
