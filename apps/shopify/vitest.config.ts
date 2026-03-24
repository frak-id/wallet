import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
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
