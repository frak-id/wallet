import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        test: {
            name: "core-sdk-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "@frak-labs/test-foundation/shared-setup",
            ],
            include: ["src/**/*.{test,spec}.ts"],
            exclude: ["cdn/**"],
            coverage: {
                include: ["src/**/*.ts"],
                exclude: [
                    "cdn/**",
                    // Exclude bundle file (used for CDN)
                    "src/bundle.ts",
                    // Exclude type definitions
                    "src/types/**/*.ts",
                ],
            },
        },
    })
);
