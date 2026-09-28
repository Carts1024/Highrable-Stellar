import { buildPageMetadata, getStaticSeoRoute } from "@/core/seo";
import { LandingPageV2 } from "@/features/landing-v2";

import type { Metadata } from "next";

const routeSeo = getStaticSeoRoute("root");

export const metadata: Metadata = buildPageMetadata(routeSeo);

export default function HomePage() {
  return <LandingPageV2 />;
}
