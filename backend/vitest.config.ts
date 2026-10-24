import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    env: {
      EASYPOST_API_KEY: process.env.EASYPOST_API_KEY || "",
      CLOVER_API_TOKEN: "test_token_clover",
    },
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
