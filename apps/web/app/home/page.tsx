import { env } from "@/core/config/env";
import { buildPageMetadata, getStaticSeoRoute } from "@/core/seo";
import { LandingPageV2 } from "@/features/landing-v2";

import type { Metadata } from "next";

const routeSeo = getStaticSeoRoute("home");

export const metadata: Metadata = buildPageMetadata(routeSeo);

export default function HomeLandingV2Page() {
  return <LandingPageV2 waitlistMode={env.NEXT_PUBLIC_WAITLIST_MODE} />;
}
