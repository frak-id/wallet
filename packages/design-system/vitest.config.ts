import sharedConfig, {
    getReactOnlyPlugins,
} from "@frak-labs/test-foundation/vitest.shared";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { defineConfig, mergeConfig } from "vitest/config";

const plugins = await getReactOnlyPlugins();

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: [...plugins, vanillaExtractPlugin()],
        test: {
            name: "design-system-unit",
            setupFiles: [
                "@frak-labs/test-foundation/react-testing-library-setup",
                "@frak-labs/test-foundation/shared-setup",
            ],
            include: ["src/**/*.{test,spec}.{ts,tsx}"],
        },
    })
);
