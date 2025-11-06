import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "core-sdk-unit",
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
        include: ["src/**/*.{test,spec}.ts"],
        exclude: [
            "node_modules/**",
            "dist/**",
            "cdn/**",
            "**/*.d.ts",
            "**/*.config.ts",
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["src/**/*.ts"],
            exclude: [
                "node_modules/**",
                "dist/**",
                "cdn/**",
                "**/*.d.ts",
                "**/*.config.ts",
                "**/*.{test,spec}.ts",
                "coverage/**/*",
                // Exclude bundle file (used for CDN)
                "src/bundle.ts",
                // Exclude type definitions
                "src/types/**/*.ts",
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
