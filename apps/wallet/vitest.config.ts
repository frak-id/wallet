import sharedConfig, {
    getReactTestPlugins,
} from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: await getReactTestPlugins(),
        test: {
            name: "wallet-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "@frak-labs/test-foundation/shared-setup",
                "@frak-labs/test-foundation/apps-setup",
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
                    // Exclude component files (focus coverage on business logic)
                    "**/component/**/*.tsx",
                    "**/components/**/*.tsx",
                ],
            },
        },
    })
);
