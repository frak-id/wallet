import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        test: {
            name: "shopify-unit",
            environment: "node",
            include: ["**/*.test.ts"],
            exclude: [
                "node_modules",
                "build",
                ".sst",
                ".react-router",
                "extensions",
            ],
        },
    })
);
