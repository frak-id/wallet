/**
 * Shared Vitest Configuration
 *
 * This configuration provides common settings used across all test projects
 * in the monorepo. Individual project configs extend this and add project-specific
 * customization (plugins, setupFiles, coverage includes/excludes, etc.).
 *
 * Usage:
 * import { defineConfig, mergeConfig } from "vitest/config";
 * import sharedConfig, { getReactTestPlugins } from "../../vitest.shared";
 *
 * export default mergeConfig(
 *   sharedConfig,
 *   defineConfig({
 *     plugins: getReactTestPlugins(),
 *     ... other project-specific config ...
 *   })
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

// Use generic type to avoid importing vite types that may not be available in all projects
type VitePlugin = any;

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
 * Plugin Configuration Helpers
 *
 * These helpers provide consistent plugin configurations across test projects,
 * reducing boilerplate and ensuring all projects use the same plugin setup.
 */

/**
 * Standard Vite plugins for React projects with TypeScript path mapping
 *
 * Includes:
 * - @vitejs/plugin-react: JSX transformation and React Fast Refresh
 * - vite-tsconfig-paths: Resolves TypeScript path aliases from tsconfig.json
 *
 * Used by: wallet, listener, business apps
 *
 * Note: Uses dynamic imports to avoid loading dependencies for projects that don't need them.
 *
 * @param options - Optional configuration
 * @param options.tsconfigProjects - Custom tsconfig file paths for vite-tsconfig-paths
 * @returns Array of Vite plugins for React + TypeScript projects
 *
 * @example
 * ```typescript
 * // Standard usage (auto-discovers tsconfig.json):
 * plugins: getReactTestPlugins()
 *
 * // Custom tsconfig location:
 * plugins: getReactTestPlugins({ tsconfigProjects: ["./tsconfig.json"] })
 * ```
 */
export async function getReactTestPlugins(options?: {
    tsconfigProjects?: string[];
}): Promise<VitePlugin[]> {
    const { tsconfigProjects } = options || {};

    // Dynamic imports to avoid loading these packages for projects that don't use them
    // Using any cast to suppress type errors - works at runtime but bypasses type-checking
    const [{ default: react }, { default: tsconfigPaths }] = (await Promise.all(
        [
            import(/* @vite-ignore */ "@vitejs/plugin-react"),
            import(/* @vite-ignore */ "vite-tsconfig-paths"),
        ]
    )) as any;

    return [
        react(),
        tsconfigPaths(
            tsconfigProjects ? { projects: tsconfigProjects } : undefined
        ),
    ];
}

/**
 * Minimal plugins for React-only projects without TypeScript path mapping
 *
 * Includes:
 * - @vitejs/plugin-react: JSX transformation and React Fast Refresh
 *
 * Used by: wallet-shared package (uses relative imports, no path aliases)
 *
 * Note: Uses dynamic import to avoid loading React plugin for projects that don't need it.
 *
 * @returns Array containing only the React plugin
 *
 * @example
 * ```typescript
 * plugins: getReactOnlyPlugins()
 * ```
 */
export async function getReactOnlyPlugins(): Promise<VitePlugin[]> {
    // Dynamic import to avoid loading React plugin for projects that don't use it
    // Using any cast to suppress type errors - works at runtime but bypasses type-checking
    const { default: react } = (await import(
        /* @vite-ignore */ "@vitejs/plugin-react"
    )) as any;
    return [react()];
}
