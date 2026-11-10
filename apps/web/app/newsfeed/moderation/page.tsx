import { buildNoIndexMetadata } from "@/core/seo";
import { NewsfeedModerationPage } from "@/features/newsfeed/newsfeed-moderation-page";

import type { Metadata } from "next";

export const metadata: Metadata = buildNoIndexMetadata(
  "Newsfeed moderation | Highrable",
  "Members-only Newsfeed moderation queue.",
  "/newsfeed/moderation",
);

export default function NewsfeedModerationRoutePage() {
  return <NewsfeedModerationPage />;
}
