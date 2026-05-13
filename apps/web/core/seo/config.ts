import { APP_DESCRIPTION, APP_NAME } from "@/core/constants";
import { env } from "@/core/config/env";
import { normalizeCanonicalPath, normalizeSiteUrl } from "@/core/seo/schemas";

export interface ISeoConfig {
  readonly appName: string;
  readonly defaultTitle: string;
  readonly titleTemplate: string;
  readonly description: string;
  readonly siteUrl: URL;
  readonly defaultImagePath: string;
  readonly twitterCard: "summary" | "summary_large_image";
}

export type TSeoRouteKey =
  | "root"
  | "home"
  | "talent"
  | "jobs"
  | "marketplace"
  | "dashboard"
  | "postJob";

export interface IStaticSeoRoute {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly index: boolean;
  readonly changeFrequency?: "daily" | "weekly" | "monthly";
  readonly priority?: number;
}

export const SEO_CONFIG: ISeoConfig = {
  appName: APP_NAME,
  defaultTitle: `${APP_NAME} | Web3 Freelancing on Stellar`,
  titleTemplate: `%s | ${APP_NAME}`,
  description: APP_DESCRIPTION,
  siteUrl: normalizeSiteUrl(env.NEXT_PUBLIC_APP_DOMAIN, env.NODE_ENV),
  defaultImagePath: "/logo/highrable-icon.jpg",
  twitterCard: "summary_large_image",
};

export const STATIC_SEO_ROUTES: Record<TSeoRouteKey, IStaticSeoRoute> = {
  root: {
    path: "/",
    title: "Web3 Freelancing on Stellar",
    description: APP_DESCRIPTION,
    index: true,
    changeFrequency: "weekly",
    priority: 1,
  },
  home: {
    path: "/home",
    title: "Home",
    description: APP_DESCRIPTION,
    index: true,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  talent: {
    path: "/talent",
    title: "Find Stellar Freelance Talent",
    description: "Discover wallet-based freelancers with escrow-verified work history on Highrable.",
    index: true,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  jobs: {
    path: "/jobs",
    title: "Browse Web3 Jobs",
    description: "Find freelance jobs backed by Stellar escrow and wallet-based reputation.",
    index: true,
    changeFrequency: "daily",
    priority: 0.9,
  },
  marketplace: {
    path: "/marketplace",
    title: "Stellar Freelance Marketplace",
    description: "Browse active Highrable jobs with escrow safety signals and Stellar payment flows.",
    index: true,
    changeFrequency: "daily",
    priority: 0.9,
  },
  dashboard: {
    path: "/dashboard",
    title: "Dashboard",
    description: "Manage your Highrable jobs, applications, and escrow activity.",
    index: false,
  },
  postJob: {
    path: "/post-job",
    title: "Post a Job",
    description: "Create a Highrable job and prepare Stellar escrow funding.",
    index: false,
  },
};

export function getStaticSeoRoute(routeKey: TSeoRouteKey): IStaticSeoRoute {
  return STATIC_SEO_ROUTES[routeKey];
}

export function getSiteUrl(): URL {
  return new URL(SEO_CONFIG.siteUrl.toString());
}

export function buildCanonicalUrl(path: string): URL {
  return new URL(normalizeCanonicalPath(path), getSiteUrl());
}
