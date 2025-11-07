import preact from "@preact/preset-vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../test-setup/vitest.shared";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: [preact(), tsconfigPaths()],
        test: {
            name: "components-sdk-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "../../test-setup/shared-setup.ts",
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
