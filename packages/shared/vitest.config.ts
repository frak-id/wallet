import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineProject } from "vitest/config";

export default defineProject({
    plugins: [tsconfigPaths(), react()],
    test: {
        environment: "happy-dom",
        setupFiles: "./vitest.setup.ts",
        css: {
            modules: {
                classNameStrategy: "non-scoped",
            },
        },
    },
});
