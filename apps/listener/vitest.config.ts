import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        name: "listener-unit",
        globals: true,
        environment: "jsdom",
        setupFiles: ["./tests/vitest-setup.ts"],
        include: ["app/**/*.{test,spec}.{ts,tsx}"],
        exclude: [
            "node_modules/**",
            "build/**",
            "**/*.e2e.{test,spec}.{ts,tsx}",
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["app/**/*.{ts,tsx}"],
            exclude: [
                "node_modules/**",
                "build/**",
                "**/*.d.ts",
                "**/*.config.ts",
                "**/*.{test,spec}.{ts,tsx}",
                "coverage/**/*",
                // Exclude UI components from coverage (focus on business logic)
                "**/component/**/*.tsx",
                "app/module/modal/component/**/*.tsx",
                "app/module/embedded/component/**/*.tsx",
                // Exclude entry points and routes
                "app/main.tsx",
                "app/App.tsx",
            ],
            thresholds: {
                lines: 40,
                functions: 40,
                branches: 40,
                statements: 40,
            },
        },
        testTimeout: 10000,
        hookTimeout: 10000,
    },
});
