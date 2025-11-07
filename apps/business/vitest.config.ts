import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig, {
    getReactTestPlugins,
} from "../../test-setup/vitest.shared";

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
                "../../test-setup/shared-setup.ts",
                "../../test-setup/apps-setup.ts",
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
                ],
            },
        },
    })
);
