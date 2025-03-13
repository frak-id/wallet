import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        workspace: ["sdk/*/vitest.config.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
        },
    },
});
