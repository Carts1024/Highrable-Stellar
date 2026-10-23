import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    fileParallelism: false,
    include: ["tests/**/*.test.ts", "convex/**/*.test.ts"],
    restoreMocks: true,
    setupFiles: ["./tests/setup.ts"],
    unstubEnvs: true,
  },
});
