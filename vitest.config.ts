/**
 * Vitest 4.0 Root Configuration with Projects
 *
 * This configuration enables running tests across all projects in the monorepo
 * with a single command using the new Vitest 4 "projects" API.
 *
 * Each project can have its own specific configuration while inheriting common
 * settings from vitest.shared.ts.
 *
 * Usage:
 * - `vitest` - Run all tests across all projects in parallel
 * - `vitest --project wallet-unit` - Run only wallet tests
 * - `vitest --project *-sdk-unit` - Run all SDK tests
 * - `vitest --ui` - Open Vitest UI for all projects
 * - `vitest --coverage` - Generate coverage for all projects
 *
 * Projects:
 * - wallet-unit: Wallet app (React Router v7)
 * - listener-unit: Listener iframe app
 * - business-unit: Business dashboard (TanStack Start)
 * - wallet-shared-unit: Shared wallet utilities package
 * - core-sdk-unit: Core SDK (framework-agnostic)
 * - react-sdk-unit: React SDK (hooks and providers)
 * - backend-unit: Elysia backend service (Node environment)
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Projects configuration - discovers all vitest.config.ts files in the monorepo
        projects: [
            // Apps: wallet, listener, business
            "apps/*/vitest.config.ts",

            // Packages: wallet-shared
            "packages/*/vitest.config.ts",

            // SDK: core, react
            "sdk/*/vitest.config.ts",

            // Services: backend
            "services/*/vitest.config.ts",
        ],
    },
});
