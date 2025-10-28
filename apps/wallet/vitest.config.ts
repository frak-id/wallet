import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        name: "wallet-unit",
        globals: true,
        environment: "jsdom",
        setupFiles: [
            "./tests/vitest-setup.ts",
            "../../packages/wallet-shared/src/test/setup-msw.ts",
        ],
        include: [
            "app/**/*.{test,spec}.{ts,tsx}",
            "../../packages/wallet-shared/src/**/*.{test,spec}.{ts,tsx}",
        ],
        exclude: [
            "tests/**/*",
            "node_modules/**",
            "build/**",
            "**/*.e2e.{test,spec}.{ts,tsx}",
            "playwright.config.ts",
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "node_modules/**",
                "tests/**",
                "build/**",
                "**/*.d.ts",
                "**/*.config.ts",
                "**/*.{test,spec}.{ts,tsx}",
                "**/*.e2e.{test,spec}.{ts,tsx}",
                "app/entry.*.tsx",
                "app/root.tsx",
                "app/routes.ts",
                "playwright.config.ts",
                "tests/**/*",
                "coverage/**/*",
            ],
            thresholds: {
                lines: 40,
                functions: 40,
                branches: 40,
                statements: 40,
            },
        },
        testTimeout: 10000,
        hookTimeout: 10000,
    },
});
