import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // One project per `vitest.config.ts`, discovered by glob.
        projects: [
            "apps/*/vitest.config.ts",
            "packages/*/vitest.config.ts",
            "sdk/*/vitest.config.ts",
            "services/*/vitest.config.ts",
            // Outside the workspace, so it needs its own entry.
            "scripts/vitest.config.ts",
        ],
    },
});
