/**
 * API V2 Vitest Configuration
 *
 * This configuration sets up testing for Frak V2 API service.
 * Uses Node environment (not jsdom) since this is a server-side application.
 *
 * Key differences from frontend projects:
 * - environment: "node" (not "jsdom")
 * - No React plugins needed
 * - Backend-specific mocks (Postgres, Drizzle)
 *
 * Usage:
 * - `bun run test` - Run all tests
 * - `bun run test:watch` - Watch mode
 * - `bun run test:coverage` - With coverage
 */

import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            "@api-core": `${__dirname}/src/core/index.ts`,
            "@api-core/*": `${__dirname}/src/core/*`,
            "@api-domains/*": `${__dirname}/src/domains/*`,
            "@api-infrastructure": `${__dirname}/src/infrastructure/index.ts`,
            "@api-infrastructure/*": `${__dirname}/src/infrastructure/*`,
            "@api-interfaces/*": `${__dirname}/src/interfaces/*`,
        },
    },
    test: {
        name: "api-v2",

        // Enable global test APIs (describe, it, expect, vi, etc.)
        globals: true,

        // Backend tests need Node environment (not jsdom)
        environment: "node",

        // Timeouts for tests and hooks (10 seconds each)
        testTimeout: 10000,
        hookTimeout: 10000,

        // Pool configuration for optimized parallel execution
        pool: "threads",

        // Full isolation ensures test independence
        isolate: true,

        // Leave 1 CPU core free for system operations
        maxWorkers: Math.max(1, os.cpus().length - 1),

        // Run test files in parallel
        fileParallelism: true,

        // Backend tests should run sequentially to avoid mock interference
        sequence: {
            concurrent: false,
        },

        // Setup files - API-specific mocks
        setupFiles: ["./test/vitest-setup.ts"],

        // Coverage configuration
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
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/*.test.ts",
                "src/**/*.spec.ts",
                "src/index.ts",
                "src/**/*.d.ts",
                "src/**/*.config.ts",
            ],
        },

        // Exclude patterns
        exclude: [
            "node_modules/**",
            "dist/**",
            "build/**",
            "**/*.d.ts",
            "**/*.config.ts",
        ],
    },
});
