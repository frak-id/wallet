import sharedConfig, {
    getReactOnlyPlugins,
} from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: await getReactOnlyPlugins(),
        test: {
            name: "wallet-shared-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "@frak-labs/test-foundation/shared-setup",
                "@frak-labs/test-foundation/apps-setup",
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
