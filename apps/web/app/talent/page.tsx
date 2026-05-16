import { buildPageMetadata, getStaticSeoRoute } from "@/core/seo";
import { TalentPage } from "@/features/talent";

import type { Metadata } from "next";

const routeSeo = getStaticSeoRoute("talent");

export const metadata: Metadata = buildPageMetadata(routeSeo);

export default function TalentRoutePage() {
  return <TalentPage />;
}
