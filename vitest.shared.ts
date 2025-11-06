/**
 * Shared Vitest Configuration
 *
 * This configuration provides common settings used across all test projects
 * in the monorepo. Individual project configs extend this and add project-specific
 * customization (plugins, setupFiles, coverage includes/excludes, etc.).
 *
 * Usage:
 * import { defineConfig, mergeConfig } from "vitest/config";
 * import sharedConfig from "../../vitest.shared";
 *
 * export default mergeConfig(
 *   sharedConfig,
 *   defineConfig({ ... project-specific config ... })
 * );
 *
 * Note on setupFiles:
 * Each project must specify its own setupFiles paths (e.g., "./tests/vitest-setup.ts",
 * "../../test-setup/shared-setup.ts") because Vitest resolves these paths relative to
 * the project's config file location. This is a Vitest architectural requirement and
 * cannot be abstracted into this shared config. While this creates some repetition,
 * the actual setup logic is properly shared in the test-setup/ directory to maintain
 * DRY principles.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Enable global test APIs (describe, it, expect, vi, etc.)
        globals: true,

        // Use jsdom for browser-like environment (DOM API, window, document)
        environment: "jsdom",

        // Timeouts for tests and hooks (10 seconds each)
        testTimeout: 10000,
        hookTimeout: 10000,

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

        // Coverage configuration (V8 provider with 40% thresholds)
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            thresholds: {
                lines: 40,
                functions: 40,
                branches: 40,
                statements: 40,
            },
            // Common excludes for all projects
            exclude: [
                "node_modules/**",
                "dist/**",
                "build/**",
                "coverage/**/*",
                "**/*.d.ts",
                "**/*.config.ts",
                "**/*.{test,spec}.{ts,tsx}",
                "**/*.e2e.{test,spec}.{ts,tsx}",
                // UI component patterns (focus coverage on business logic)
                "**/component/**/*.tsx",
                "**/components/**/*.tsx",
            ],
        },

        // Common excludes for test discovery
        exclude: [
            "node_modules/**",
            "dist/**",
            "build/**",
            "**/*.d.ts",
            "**/*.config.ts",
            "**/*.e2e.{test,spec}.{ts,tsx}",
        ],
    },
});
