import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../test-setup/vitest.shared";

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
                "../../test-setup/shared-setup.ts",
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
