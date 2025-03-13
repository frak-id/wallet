import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "@frak-labs/core-sdk",
        environment: "happy-dom",
        coverage: {
            exclude: [
                "**/node_modules/**",
                "**/dist/**",
                "**/cdn/**",
                "**/*.d.ts",
                "*.config.ts",
            ],
        },
    },
});
