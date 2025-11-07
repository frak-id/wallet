import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig, {
    getReactOnlyPlugins,
} from "../../test-setup/vitest.shared";

const plugins = await getReactOnlyPlugins();

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins,
        test: {
            name: "ui-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "../../test-setup/shared-setup.ts",
            ],
            include: ["component/**/*.{test,spec}.{ts,tsx}"],
            coverage: {
                // Include component source files for coverage
                include: ["component/**/*.tsx", "component/**/*.ts"],
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
                ],
            },
        },
    })
);
