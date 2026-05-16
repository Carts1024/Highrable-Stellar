import { buildCanonicalUrl, STATIC_SEO_ROUTES } from "@/core/seo/config";

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return Object.values(STATIC_SEO_ROUTES)
    .filter((route) => route.index)
    .map((route) => ({
      url: buildCanonicalUrl(route.path).toString(),
      lastModified: now,
      changeFrequency: route.changeFrequency ?? "weekly",
      priority: route.priority ?? 0.7,
    }));
}
