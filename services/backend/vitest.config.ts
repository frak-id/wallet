import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

// Path aliases (@backend-utils, @backend-infrastructure, @backend-domain) are
// resolved natively from tsconfig via resolve.tsconfigPaths in the shared config.
export default mergeConfig(
    sharedConfig,
    defineConfig({
        test: {
            name: "backend-unit",

            environment: "node",

            // Backend mocks (viem, drizzle) are stateful and cannot be shared
            // across concurrent tests.
            sequence: {
                concurrent: false,
            },

            env: {
                JWT_SECRET: "test-jwt-secret-for-vitest-testing",
                JWT_SDK_SECRET: "test-jwt-sdk-secret-for-vitest-testing",
                JWT_BUSINESS_SECRET:
                    "test-jwt-business-secret-for-vitest-testing",
            },

            setupFiles: ["./test/vitest-setup.ts"],

            coverage: {
                include: ["src/**/*.ts"],
                exclude: [
                    "src/**/*.test.ts",
                    "src/index.ts",
                    "src/**/*.d.ts",
                    "src/**/*.config.ts",
                ],
            },
        },
    })
);
