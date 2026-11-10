import { buildNoIndexMetadata } from "@/core/seo";
import { NewsfeedPostDetailPage } from "@/features/newsfeed/newsfeed-detail-page";

import type { Metadata } from "next";

export const metadata: Metadata = buildNoIndexMetadata(
  "Community post | Highrable",
  "Verified-member Newsfeed post.",
  "/newsfeed",
);

export default async function NewsfeedPostRoute({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return <NewsfeedPostDetailPage postId={postId} />;
}
