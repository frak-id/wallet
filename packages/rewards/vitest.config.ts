import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        test: {
            name: "rewards-unit",
            setupFiles: ["@frak-labs/test-foundation/shared-setup"],
            include: ["src/**/*.{test,spec}.ts"],
            coverage: {
                include: ["src/**/*.ts"],
                exclude: ["src/**/index.ts"],
            },
        },
    })
);
