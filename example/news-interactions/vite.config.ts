import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import type { UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { manualChunks, onwarn } from "../../packages/shared/tooling/vite";

export default defineConfig((): UserConfig => {
    return {
        define: {
            "process.env.STAGE": JSON.stringify(process.env.STAGE),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                process.env.FRAK_WALLET_URL
            ),
            "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL),
        },
        server: {
            port: 3011,
        },
        plugins: [reactRouter(), tsconfigPaths()],
        build: {
            rollupOptions: {
                output: {
                    manualChunks,
                },
                onwarn,
            },
        },
    };
});
