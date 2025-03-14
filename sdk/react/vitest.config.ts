import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    test: {
        name: "@frak-labs/react-sdk",
        globals: true,
        environment: "happy-dom",
        coverage: {
            exclude: [
                "**/node_modules/**",
                "**/dist/**",
                "**/cdn/**",
                "**/*.d.ts",
                "*.config.ts",
            ],
        },
    },
});
