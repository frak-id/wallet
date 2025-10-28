import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    test: {
        name: "wallet-shared-unit",
        globals: true,
        environment: "jsdom",
        setupFiles: [
            "../../apps/wallet/tests/vitest-setup.ts",
            "./src/test/setup-msw.ts",
        ],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        exclude: ["node_modules/**", "**/*.d.ts", "**/*.config.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "node_modules/**",
                "**/*.d.ts",
                "**/*.config.ts",
                "**/*.{test,spec}.{ts,tsx}",
                "src/index.ts",
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
