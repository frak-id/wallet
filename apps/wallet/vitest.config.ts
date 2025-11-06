import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: [react(), tsconfigPaths()],
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
