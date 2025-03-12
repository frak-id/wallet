import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
    {
        plugins: [tsconfigPaths(), react()],
        test: {
            root: "./packages",
            environment: "happy-dom",
            setupFiles: ["./vitest.setup.ts"],
            css: {
                modules: {
                    classNameStrategy: "non-scoped",
                },
            },
        },
    },
]);
