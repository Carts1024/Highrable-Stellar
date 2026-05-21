import { buildPageMetadata, getStaticSeoRoute } from "@/core/seo";
import { JobsPage } from "@/features/jobs";

import type { Metadata } from "next";

const routeSeo = getStaticSeoRoute("jobs");

export const metadata: Metadata = buildPageMetadata(routeSeo);

export default function JobsRoutePage() {
  return <JobsPage />;
}
