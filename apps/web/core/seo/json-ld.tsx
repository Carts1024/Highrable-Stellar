import { buildCanonicalUrl, SEO_CONFIG } from "@/core/seo/config";
import { sanitizeSeoText } from "@/core/seo/schemas";

export type TJsonLdValue =
  | string
  | number
  | boolean
  | null
  | readonly TJsonLdValue[]
  | { readonly [key: string]: TJsonLdValue };

export interface ISeoJsonLdProps {
  readonly id: string;
  readonly data: TJsonLdValue;
}

export function SeoJsonLd({ id, data }: ISeoJsonLdProps) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function buildWebsiteJsonLd(): TJsonLdValue {
  const siteUrl = buildCanonicalUrl("/");

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SEO_CONFIG.appName,
    description: SEO_CONFIG.description,
    url: siteUrl.toString(),
  };
}

export function buildOrganizationJsonLd(): TJsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SEO_CONFIG.appName,
    url: buildCanonicalUrl("/").toString(),
    logo: buildCanonicalUrl(SEO_CONFIG.defaultImagePath).toString(),
  };
}

export function buildJobPostingJsonLd(input: {
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly createdAt: number;
  readonly budget: number;
  readonly asset: string;
  readonly clientWallet: string;
}): TJsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: sanitizeSeoText(input.title, "Highrable job"),
    description: sanitizeSeoText(
      input.description,
      "Stellar escrow-backed freelance job on Highrable.",
    ),
    datePosted: new Date(input.createdAt).toISOString(),
    hiringOrganization: {
      "@type": "Organization",
      name: `Highrable client ${input.clientWallet.slice(0, 8)}`,
    },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: {
      "@type": "Country",
      name: "Remote",
    },
    baseSalary: {
      "@type": "MonetaryAmount",
      currency: input.asset,
      value: {
        "@type": "QuantitativeValue",
        value: input.budget,
        unitText: "PROJECT",
      },
    },
    url: buildCanonicalUrl(input.path).toString(),
  };
}
