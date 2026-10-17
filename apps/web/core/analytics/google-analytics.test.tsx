// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import React, { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

import { GoogleAnalytics } from "./google-analytics";

const GA_MEASUREMENT_ID = "G-VLGZ3N3N99";

function getPageViewPayloads(): unknown[] {
  return (window.dataLayer ?? [])
    .filter(
      (entry): entry is unknown[] =>
        Array.isArray(entry) && entry[0] === "event" && entry[1] === "page_view",
    )
    .map((entry) => entry[2]);
}

describe("GoogleAnalytics", () => {
  beforeEach(() => {
    route.pathname = "/";
    Reflect.deleteProperty(window, "dataLayer");
    Reflect.deleteProperty(window, "gtag");
    Reflect.deleteProperty(window, "__highrableGoogleAnalyticsInitialized");
    document.getElementById("google-analytics-script")?.remove();
    document.title = "Private page title";
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    document.getElementById("google-analytics-script")?.remove();
    Reflect.deleteProperty(window, "dataLayer");
    Reflect.deleteProperty(window, "gtag");
    Reflect.deleteProperty(window, "__highrableGoogleAnalyticsInitialized");
  });

  it("initializes the Google tag once and sends one initial page view", () => {
    render(
      <StrictMode>
        <GoogleAnalytics />
      </StrictMode>,
    );

    const config = (window.dataLayer ?? []).find(
      (entry): entry is unknown[] => Array.isArray(entry) && entry[0] === "config",
    );
    const configCalls = (window.dataLayer ?? []).filter(
      (entry) => Array.isArray(entry) && entry[0] === "config",
    );
    const script = document.getElementById("google-analytics-script");

    expect(config).toEqual(["config", GA_MEASUREMENT_ID, { send_page_view: false }]);
    expect(configCalls).toHaveLength(1);
    expect(script?.getAttribute("src")).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`,
    );
    expect(script?.hasAttribute("async")).toBe(true);
    expect(getPageViewPayloads()).toEqual([
      {
        page_path: "/",
        page_location: `${window.location.origin}/`,
        page_title: "Highrable",
        page_referrer: "",
      },
    ]);
  });

  it("tracks route changes using route templates without query strings or dynamic IDs", () => {
    route.pathname = "/freelancers/GPRIVATEWALLET";
    window.history.replaceState(
      null,
      "",
      "/freelancers/GPRIVATEWALLET?tab=private&search=private-data",
    );

    const view = render(<GoogleAnalytics />);

    act(() => {
      route.pathname = "/freelancers/GANOTHERWALLET";
      window.history.replaceState(null, "", "/freelancers/GANOTHERWALLET?tab=reviews");
      view.rerender(<GoogleAnalytics />);
    });

    act(() => {
      route.pathname = "/disputes/private-dispute-id";
      window.history.replaceState(null, "", "/disputes/private-dispute-id?case=private");
      view.rerender(<GoogleAnalytics />);
    });

    expect(getPageViewPayloads()).toEqual([
      {
        page_path: "/freelancers/[walletAddress]",
        page_location: `${window.location.origin}/freelancers/[walletAddress]`,
        page_title: "Highrable",
        page_referrer: "",
      },
      {
        page_path: "/freelancers/[walletAddress]",
        page_location: `${window.location.origin}/freelancers/[walletAddress]`,
        page_title: "Highrable",
        page_referrer: `${window.location.origin}/freelancers/[walletAddress]`,
      },
      {
        page_path: "/disputes/[disputeId]",
        page_location: `${window.location.origin}/disputes/[disputeId]`,
        page_title: "Highrable",
        page_referrer: `${window.location.origin}/freelancers/[walletAddress]`,
      },
    ]);
  });
});
