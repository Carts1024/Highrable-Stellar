import { getWaitlistRouteDecision, resolveWaitlistMode } from "@/core/config/waitlist-mode";
import { NextResponse, type NextRequest } from "next/server";

/** Applies the waitlist-only browser route gate without changing API authorization. */
export function proxy(request: NextRequest) {
  const decision = getWaitlistRouteDecision({
    waitlistMode: resolveWaitlistMode(process.env.NEXT_PUBLIC_WAITLIST_MODE),
    pathname: request.nextUrl.pathname,
  });

  if (decision === "redirect") {
    return NextResponse.redirect(new URL("/", request.url), 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
