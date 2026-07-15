/**
 * Backend Vitest Configuration
 *
 * This configuration sets up testing for the Elysia backend service.
 * Uses Node environment (not jsdom) since this is a server-side application.
 *
 * Key differences from frontend projects:
 * - environment: "node" (not "jsdom")
 * - No React plugins needed
 * - Backend-specific mocks (Viem, Drizzle, SimpleWebAuthn)
 *
 * Usage:
 * - `bun run test` - Run all tests (including backend via root config)
 * - `bun run test --project backend-unit` - Run only backend tests
 * - `bun run test:watch` - Watch mode
 */

import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

// Path aliases (@backend-utils, @backend-infrastructure, @backend-domain) are
// resolved natively from tsconfig via resolve.tsconfigPaths in the shared config.
export default mergeConfig(
    sharedConfig,
    defineConfig({
        test: {
            name: "backend-unit",

            // Backend tests need Node environment (not jsdom)
            environment: "node",

            // Backend tests should run sequentially to avoid mock interference
            // The shared config enables concurrent: true, but backend mocks (viem, drizzle)
            // are stateful and can't be safely shared across concurrent tests
            sequence: {
                concurrent: false,
            },

            // Environment variables for tests
            env: {
                JWT_SECRET: "test-jwt-secret-for-vitest-testing",
                JWT_SDK_SECRET: "test-jwt-sdk-secret-for-vitest-testing",
                JWT_BUSINESS_SECRET:
                    "test-jwt-business-secret-for-vitest-testing",
            },

            // Setup files - backend-specific mocks
            setupFiles: ["./test/vitest-setup.ts"],

            // Coverage configuration
            coverage: {
                include: ["src/**/*.ts"],
                exclude: [
                    "src/**/*.test.ts",
                    "src/index.ts",
                    "src/router/**", // Router definitions
                    "src/**/*.d.ts",
                    "src/**/*.config.ts",
                ],
            },
        },
    })
);
