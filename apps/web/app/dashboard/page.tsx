import { buildNoIndexMetadata, getStaticSeoRoute } from "@/core/seo";
import { DashboardPage } from "@/features/dashboard";

import type { Metadata } from "next";

const routeSeo = getStaticSeoRoute("dashboard");

export const metadata: Metadata = buildNoIndexMetadata(
  routeSeo.title,
  routeSeo.description,
  routeSeo.path,
);

export default function DashboardRoutePage() {
  return <DashboardPage />;
}
