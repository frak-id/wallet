import sharedConfig, {
    getReactOnlyPlugins,
} from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

const plugins = await getReactOnlyPlugins();

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins,
        test: {
            name: "ui-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "@frak-labs/test-foundation/shared-setup",
            ],
            include: [
                "component/**/*.{test,spec}.{ts,tsx}",
                "hook/**/*.{test,spec}.{ts,tsx}",
            ],
            coverage: {
                // Include component and hook source files for coverage
                include: [
                    "component/**/*.tsx",
                    "component/**/*.ts",
                    "hook/**/*.ts",
                    "hook/**/*.tsx",
                ],
                // Override shared config exclude - explicitly exclude only what we don't want
                exclude: [
                    "node_modules/**",
                    "dist/**",
                    "build/**",
                    "coverage/**/*",
                    "**/*.d.ts",
                    "**/*.config.ts",
                    "**/*.css", // Exclude CSS files (they can't have code coverage)
                    "component/**/*.test.{ts,tsx}",
                    "component/**/*.spec.{ts,tsx}",
                    "hook/**/*.test.{ts,tsx}",
                    "hook/**/*.spec.{ts,tsx}",
                ],
            },
        },
    })
);
