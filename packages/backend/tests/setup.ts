import { afterEach, beforeEach, vi } from "vitest";

export const FIXED_TEST_TIME = new Date("2026-01-15T12:00:00.000Z").getTime();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FIXED_TEST_TIME);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
