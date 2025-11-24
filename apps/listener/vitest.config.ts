import sharedConfig, {
    getReactTestPlugins,
} from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: await getReactTestPlugins(),
        test: {
            name: "listener-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "@frak-labs/test-foundation/shared-setup",
                "@frak-labs/test-foundation/apps-setup",
            ],
            include: ["app/**/*.{test,spec}.{ts,tsx}"],
            coverage: {
                include: ["app/**/*.{ts,tsx}"],
                exclude: [
                    // Exclude entry points (listener app specific)
                    "app/main.tsx",
                    "app/App.tsx",
                    // Exclude component files (focus coverage on business logic)
                    "**/component/**/*.tsx",
                    "**/components/**/*.tsx",
                ],
            },
        },
    })
);
