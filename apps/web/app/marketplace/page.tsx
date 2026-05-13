import { buildPageMetadata, getStaticSeoRoute } from "@/core/seo";
import { MarketplacePage } from "@/features/marketplace";

import type { Metadata } from "next";

const routeSeo = getStaticSeoRoute("marketplace");

export const metadata: Metadata = buildPageMetadata(routeSeo);

export default function MarketplaceRoutePage() {
  return <MarketplacePage />;
}
