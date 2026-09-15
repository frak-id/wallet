/**
 * Shared Vitest config; project configs `mergeConfig` over it.
 *
 * `setupFiles` cannot live here: Vitest resolves those paths relative to the
 * project's own config file, so every project repeats them.
 */

import { maxWorkers } from "@frak-labs/test-foundation/vitest.workers";
import { defineConfig } from "vitest/config";

// Use generic type to avoid importing vite types that may not be available in all projects
type VitePlugin = any;

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        globals: true,
        environment: "jsdom",
        testTimeout: 10000,
        hookTimeout: 10000,

        // Persist transformed modules to node_modules/.vitest-cache across runs.
        // Invalidated by lockfile hash, so a dependency change resets it.
        fsModuleCache: true,

        pool: "threads",
        isolate: true,

        // Shared with scripts/vitest.config.ts: every project must agree.
        maxWorkers,

        fileParallelism: true,

        // Tests within a file run sequentially: many suites mutate shared
        // globals (window.location, global.fetch, sessionStorage, module-level
        // caches) and rely on beforeEach for isolation, which only works under
        // sequential execution. Files still run in parallel via fileParallelism.
        sequence: {
            shuffle: false,
            concurrent: false,
        },

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

        // Off locally for speed; `--coverage` or CI turns it on.
        coverage: {
            enabled: process.env.CI === "true",
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

/**
 * Vite plugins for React test projects. Imported dynamically so a project
 * without React never loads `@vitejs/plugin-react`.
 */
export async function getReactTestPlugins(): Promise<VitePlugin[]> {
    const { default: react } = (await import(
        /* @vite-ignore */ "@vitejs/plugin-react"
    )) as any;
    return [react()];
}

export const getReactOnlyPlugins = getReactTestPlugins;
