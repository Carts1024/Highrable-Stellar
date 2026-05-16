import { buildNoIndexMetadata, getStaticSeoRoute } from "@/core/seo";
import { PostJobPage } from "@/features/post-job";

import type { Metadata } from "next";

const routeSeo = getStaticSeoRoute("postJob");

export const metadata: Metadata = buildNoIndexMetadata(
  routeSeo.title,
  routeSeo.description,
  routeSeo.path,
);

export default function PostJobRoutePage() {
  return <PostJobPage />;
}
