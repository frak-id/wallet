import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig, {
    getReactTestPlugins,
} from "../../test-setup/vitest.shared";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: await getReactTestPlugins(),
        test: {
            name: "wallet-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "../../test-setup/shared-setup.ts",
                "../../test-setup/apps-setup.ts",
                "../../packages/wallet-shared/src/test/setup-msw.ts",
            ],
            include: ["app/**/*.{test,spec}.{ts,tsx}"],
            exclude: [
                "tests/**/*",
                "playwright.config.ts",
                "**/*.e2e.{test,spec}.{ts,tsx}",
            ],
            coverage: {
                include: ["app/**/*.{ts,tsx}"],
                exclude: [
                    "tests/**/*",
                    "app/entry.*.tsx",
                    "app/root.tsx",
                    "app/routes.ts",
                    "playwright.config.ts",
                ],
            },
        },
    })
);
