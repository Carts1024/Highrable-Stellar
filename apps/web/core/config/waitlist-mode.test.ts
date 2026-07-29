import { describe, expect, it } from "vitest";

import {
  getWaitlistRouteDecision,
  isWaitlistPublicPath,
  resolveWaitlistMode,
} from "./waitlist-mode";

describe("resolveWaitlistMode", () => {
  it.each([
    [undefined, true],
    [null, true],
    ["", true],
    ["true", true],
    [" TRUE ", true],
    ["invalid", true],
    ["1", true],
    ["false", false],
    [" FALSE ", false],
  ])("resolves %j to %s", (value, expected) => {
    expect(resolveWaitlistMode(value)).toBe(expected);
  });
});

describe("isWaitlistPublicPath", () => {
  it.each(["/", "/home", "/home/"])("allows the marketing route %s", (pathname) => {
    expect(isWaitlistPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/marketplace",
    "/marketplace/jobs/job-id",
    "/jobs",
    "/post-job",
    "/dashboard",
    "/freelancers/wallet",
    "/clients/wallet",
    "/proof/escrow-id",
    "/onboarding",
    "/admin",
  ])("does not expose the product route %s", (pathname) => {
    expect(isWaitlistPublicPath(pathname)).toBe(false);
  });
});

describe("getWaitlistRouteDecision", () => {
  it.each([
    "/",
    "/home",
    "/api/auth/stellar/challenge",
    "/_next/static/chunk.js",
    "/logo/icon.jpg",
  ])("allows public or infrastructure path %s in waitlist mode", (pathname) => {
    expect(getWaitlistRouteDecision({ waitlistMode: true, pathname })).toBe("allow");
  });

  it.each(["/marketplace", "/dashboard", "/proof/escrow-id", "/admin/disputes"])(
    "redirects product path %s in waitlist mode",
    (pathname) => {
      expect(getWaitlistRouteDecision({ waitlistMode: true, pathname })).toBe("redirect");
    },
  );

  it.each(["/marketplace", "/dashboard", "/proof/escrow-id", "/admin/disputes"])(
    "allows product path %s in full mode",
    (pathname) => {
      expect(getWaitlistRouteDecision({ waitlistMode: false, pathname })).toBe("allow");
    },
  );
});
