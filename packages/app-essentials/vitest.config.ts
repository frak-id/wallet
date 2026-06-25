import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        test: {
            name: "app-essentials-unit",
            include: ["src/**/*.{test,spec}.ts"],
        },
    })
);
