import tanstackRouter from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { lightningCssConfig, onwarn } from "../../packages/dev-tooling";

const DEBUG = JSON.stringify(false);

export default defineConfig((): UserConfig => {
    return {
        css: lightningCssConfig,
        define: {
            "process.env.STAGE": JSON.stringify(process.env.STAGE),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                process.env.FRAK_WALLET_URL
            ),
            "process.env.DEBUG": JSON.stringify(DEBUG),
        },
        server: {
            port: 3012,
        },
        plugins: [
            tanstackRouter({
                routesDirectory: "./app/routes",
                generatedRouteTree: "./app/routeTree.gen.ts",
                autoCodeSplitting: true,
            }),
            viteReact(),
            tsconfigPaths(),
        ],
        build: {
            rollupOptions: {
                onwarn,
            },
        },
        optimizeDeps: {
            exclude: ["react-scan"],
        },
    };
});
