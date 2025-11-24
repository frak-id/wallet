import sharedConfig from "@frak-labs/test-foundation/vitest.shared";
import preact from "@preact/preset-vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: [preact(), tsconfigPaths()],
        test: {
            name: "components-sdk-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "@frak-labs/test-foundation/shared-setup",
            ],
            include: ["src/**/*.{test,spec}.{ts,tsx}"],
            exclude: ["cdn/**", "dist/**"],
            coverage: {
                include: ["src/**/*.{ts,tsx}"],
                exclude: [
                    "cdn/**",
                    "dist/**",
                    // Exclude type definitions
                    "src/**/*.d.ts",
                    // Exclude index files (barrel exports only)
                    "**/index.{ts,tsx}",
                ],
            },
        },
    })
);
