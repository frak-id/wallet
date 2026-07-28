import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        test: {
            name: "dev-tooling-unit",
            include: ["src/**/*.{test,spec}.ts"],
            // Pure node fs/zlib tests — skip the jsdom env from the shared config.
            environment: "node",
        },
    })
);
