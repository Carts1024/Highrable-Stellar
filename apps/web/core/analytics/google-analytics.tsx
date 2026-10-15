"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

const GA_MEASUREMENT_ID = "G-VLGZ3N3N99";
const DYNAMIC_ROUTE_PATTERNS = [
  [/^\/marketplace\/jobs\/[^/]+$/u, "/marketplace/jobs/[jobId]"],
  [/^\/freelancers\/[^/]+$/u, "/freelancers/[walletAddress]"],
  [/^\/clients\/[^/]+$/u, "/clients/[walletAddress]"],
  [/^\/proof\/[^/]+$/u, "/proof/[escrowId]"],
  [/^\/disputes\/[^/]+$/u, "/disputes/[disputeId]"],
  [/^\/work-agreements\/[^/]+\/review$/u, "/work-agreements/[agreementId]/review"],
  [/^\/admin\/disputes\/[^/]+$/u, "/admin/disputes/[disputeId]"],
] as const;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __highrableGoogleAnalyticsInitialized?: boolean;
  }
}

function normalizeAnalyticsPath(pathname: string): string {
  return DYNAMIC_ROUTE_PATTERNS.find(([pattern]) => pattern.test(pathname))?.[1] ?? pathname;
}

function getExternalReferrer(): string {
  if (!document.referrer) {
    return "";
  }

  try {
    return new URL(document.referrer).origin;
  } catch {
    return "";
  }
}

function GoogleAnalyticsPageViews() {
  const pathname = usePathname();
  const previousPageRef = useRef<string | null>(null);

  useEffect(() => {
    const pagePath = normalizeAnalyticsPath(pathname);
    if (previousPageRef.current === pathname) {
      return;
    }

    if (!window.__highrableGoogleAnalyticsInitialized) {
      window.dataLayer = window.dataLayer ?? [];
      const gtag = (...args: unknown[]) => {
        window.dataLayer?.push(args);
      };
      window.gtag = gtag;
      gtag("js", new Date());
      gtag("set", {
        page_location: `${window.location.origin}${pagePath}`,
        page_title: "Highrable",
      });
      gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
      window.__highrableGoogleAnalyticsInitialized = true;

      if (!document.getElementById("google-analytics-script")) {
        const script = document.createElement("script");
        script.id = "google-analytics-script";
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(script);
      }
    }

    const pageLocation = `${window.location.origin}${pagePath}`;
    const pageReferrer = previousPageRef.current
      ? `${window.location.origin}${normalizeAnalyticsPath(previousPageRef.current)}`
      : getExternalReferrer();
    window.gtag?.("set", { page_location: pageLocation, page_title: "Highrable" });
    window.gtag?.("event", "page_view", {
      page_path: pagePath,
      page_location: pageLocation,
      page_title: "Highrable",
      page_referrer: pageReferrer,
    });
    previousPageRef.current = pathname;
  }, [pathname]);

  return null;
}

export function GoogleAnalytics() {
  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsPageViews />
    </Suspense>
  );
}
