import { buildCanonicalUrl } from "@/core/seo/config";

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/post-job"],
    },
    sitemap: buildCanonicalUrl("/sitemap.xml").toString(),
  };
}
