import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig, {
    getReactOnlyPlugins,
} from "../../test-setup/vitest.shared";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: await getReactOnlyPlugins(),
        test: {
            name: "wallet-shared-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "../../test-setup/shared-setup.ts",
                "../../test-setup/apps-setup.ts",
                "./src/test/setup-msw.ts",
            ],
            include: ["src/**/*.{test,spec}.{ts,tsx}"],
            coverage: {
                include: ["src/**/*.{ts,tsx}"],
                exclude: [
                    "src/index.ts", // Barrel export file
                    "src/test/**", // Test utilities
                ],
            },
        },
    })
);
