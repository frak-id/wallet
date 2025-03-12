import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "happy-dom",
        globals: true,
        include: ["**/*.{test,spec}.?(c|m)[jt]s?(x)"],
        exclude: ["**/node_modules/**", "**/dist/**"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "**/node_modules/**",
                "**/dist/**",
                "**/cdn/**",
                "**/*.d.ts",
                "**/*.config.ts",
            ],
        },
    },
});
