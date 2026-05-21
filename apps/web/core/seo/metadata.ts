import { buildCanonicalUrl, SEO_CONFIG } from "@/core/seo/config";
import { sanitizeSeoText } from "@/core/seo/schemas";

import type { Metadata } from "next";

export interface IPageMetadataInput {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly index?: boolean;
  readonly imagePath?: string;
  readonly type?: "website" | "article" | "profile";
}

export function buildPageMetadata(input: IPageMetadataInput): Metadata {
  const title = sanitizeSeoText(input.title, SEO_CONFIG.defaultTitle);
  const description = sanitizeSeoText(input.description, SEO_CONFIG.description);
  const canonicalUrl = buildCanonicalUrl(input.path);
  const imageUrl = buildCanonicalUrl(input.imagePath ?? SEO_CONFIG.defaultImagePath);
  const shouldIndex = input.index ?? true;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: shouldIndex,
      follow: shouldIndex,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SEO_CONFIG.appName,
      type: input.type ?? "website",
      images: [
        {
          url: imageUrl,
          alt: SEO_CONFIG.appName,
        },
      ],
    },
    twitter: {
      card: SEO_CONFIG.twitterCard,
      title,
      description,
      images: [imageUrl.toString()],
    },
  };
}

export function buildNoIndexMetadata(title: string, description: string, path: string): Metadata {
  return buildPageMetadata({
    title,
    description,
    path,
    index: false,
  });
}
