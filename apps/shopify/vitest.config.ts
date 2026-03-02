import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        name: "shopify-unit",
        environment: "node",
        include: ["**/*.test.ts"],
        exclude: [
            "node_modules",
            "build",
            ".sst",
            ".react-router",
            "extensions",
        ],
    },
});
