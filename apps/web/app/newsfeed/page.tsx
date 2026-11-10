import { buildNoIndexMetadata } from "@/core/seo";
import { NewsfeedPage } from "@/features/newsfeed";

import type { Metadata } from "next";

export const metadata: Metadata = buildNoIndexMetadata(
  "Newsfeed | Highrable",
  "Verified-member community feed for Highrable.",
  "/newsfeed",
);

export default function NewsfeedRoutePage() {
  return <NewsfeedPage />;
}
