import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig, {
    getReactTestPlugins,
} from "../../test-setup/vitest.shared";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: await getReactTestPlugins(),
        test: {
            name: "listener-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "../../test-setup/shared-setup.ts",
                "../../test-setup/apps-setup.ts",
            ],
            include: ["app/**/*.{test,spec}.{ts,tsx}"],
            coverage: {
                include: ["app/**/*.{ts,tsx}"],
                exclude: [
                    // Exclude entry points (listener app specific)
                    "app/main.tsx",
                    "app/App.tsx",
                ],
            },
        },
    })
);
