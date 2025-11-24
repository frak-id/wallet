import sharedConfig, {
    getReactTestPlugins,
} from "@frak-labs/test-foundation/vitest.shared";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
    sharedConfig,
    defineConfig({
        plugins: await getReactTestPlugins({
            tsconfigProjects: ["./tsconfig.json"],
        }),
        test: {
            name: "business-unit",
            setupFiles: [
                "./tests/vitest-setup.ts",
                "@frak-labs/test-foundation/shared-setup",
                "@frak-labs/test-foundation/apps-setup",
            ],
            include: ["src/**/*.{test,spec}.{ts,tsx}"],
            exclude: [".output/**", ".tanstack/**"],
            coverage: {
                include: ["src/**/*.{ts,tsx}"],
                exclude: [
                    // Build output directories (TanStack Start specific)
                    ".output/**",
                    ".tanstack/**",
                    // Route files (TanStack Router specific)
                    "routes/**/*.tsx",
                    "src/router.tsx",
                    "src/routeTree.gen.ts",
                    "src/routes/__root.tsx",
                    // Exclude component files (focus coverage on business logic)
                    "**/component/**/*.tsx",
                    "**/components/**/*.tsx",
                ],
            },
        },
    })
);
