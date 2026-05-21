import { AppProviders } from "@/core/providers/app-providers";
import {
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  SEO_CONFIG,
  SeoJsonLd,
} from "@/core/seo";
import { AppShell } from "@/features/common";
import "@repo/ui/globals.css";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";

import type { Metadata } from "next";

import "./globals.css";

const sansFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: SEO_CONFIG.siteUrl,
  title: {
    default: SEO_CONFIG.defaultTitle,
    template: SEO_CONFIG.titleTemplate,
  },
  description: SEO_CONFIG.description,
  alternates: {
    canonical: buildCanonicalUrl("/"),
  },
  icons: {
    icon: [{ url: "/logo/highrable-icon.jpg", type: "image/jpeg" }, { url: "/favicon.ico" }],
    shortcut: "/logo/highrable-icon.jpg",
    apple: "/logo/highrable-icon.jpg",
  },
  openGraph: {
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.description,
    url: buildCanonicalUrl("/"),
    siteName: SEO_CONFIG.appName,
    type: "website",
    images: [
      {
        url: buildCanonicalUrl(SEO_CONFIG.defaultImagePath),
        alt: SEO_CONFIG.appName,
      },
    ],
  },
  twitter: {
    card: SEO_CONFIG.twitterCard,
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.description,
    images: [buildCanonicalUrl(SEO_CONFIG.defaultImagePath).toString()],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sansFont.variable} ${monoFont.variable}`}>
        <AppProviders>
          <SeoJsonLd id="website-json-ld" data={buildWebsiteJsonLd()} />
          <SeoJsonLd id="organization-json-ld" data={buildOrganizationJsonLd()} />
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
