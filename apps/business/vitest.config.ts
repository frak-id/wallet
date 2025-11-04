import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [
        react(),
        tsconfigPaths({
            projects: ["./tsconfig.json"],
        }),
    ],
    test: {
        name: "business-unit",
        globals: true,
        environment: "jsdom",
        setupFiles: ["./tests/vitest-setup.ts"],
        // Optimized reporters for CI vs local development
        reporters: process.env.CI
            ? [
                  "verbose", // Detailed output for CI logs
                  "github-actions", // GitHub Actions annotations
                  ["html", { outputFile: "coverage/test-report.html" }],
              ]
            : [
                  ["default", { summary: true }], // Clean summary for local
                  ["html", { outputFile: "coverage/test-report.html" }],
              ],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        exclude: [
            "node_modules/**",
            "build/**",
            ".output/**",
            ".tanstack/**",
            "**/*.e2e.{test,spec}.{ts,tsx}",
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "node_modules/**",
                "build/**",
                ".output/**",
                ".tanstack/**",
                "**/*.d.ts",
                "**/*.config.ts",
                "**/*.{test,spec}.{ts,tsx}",
                "coverage/**/*",
                // Exclude UI components from coverage (focus on business logic)
                "**/component/**/*.tsx",
                "**/components/**/*.tsx",
                // Exclude route files
                "routes/**/*.tsx",
                "src/router.tsx",
                "src/routeTree.gen.ts",
                // Exclude entry points
                "src/routes/__root.tsx",
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
