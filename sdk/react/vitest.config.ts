import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        oxc: {
            jsx: {
                runtime: "automatic",
            },
        },
        test: {
            name: "react-sdk-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "@frak-labs/test-foundation/shared-setup",
            ],
            include: ["src/**/*.{test,spec}.{ts,tsx}"],
            coverage: {
                include: ["src/**/*.{ts,tsx}"],
                exclude: [
                    // Exclude index files (barrel exports only)
                    "**/index.{ts,tsx}",
                ],
            },
        },
    })
);
