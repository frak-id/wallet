import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../test-setup/vitest.shared";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        test: {
            name: "core-sdk-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "../../test-setup/shared-setup.ts",
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
