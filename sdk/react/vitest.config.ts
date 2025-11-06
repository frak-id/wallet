import { defineConfig } from "vitest/config";

export default defineConfig({
    oxc: {
        jsx: {
            runtime: "automatic",
        },
    },
    test: {
        name: "react-sdk-unit",
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
        exclude: ["node_modules/**", "dist/**", "**/*.d.ts", "**/*.config.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "node_modules/**",
                "dist/**",
                "**/*.d.ts",
                "**/*.config.ts",
                "**/*.{test,spec}.{ts,tsx}",
                "coverage/**/*",
                // Exclude index files (barrel exports only)
                "**/index.{ts,tsx}",
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
