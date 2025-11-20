import tanstackRouter from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import type { UserConfig } from "rolldown-vite";
import { defineConfig } from "rolldown-vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { lightningCssConfig, onwarn } from "../../packages/dev-tooling";

const DEBUG = process.env.DEBUG === "true";
const isProd = process.env.STAGE?.includes("prod") ?? false;

export default defineConfig((): UserConfig => {
    return {
        css: lightningCssConfig,
        define: {
            "process.env.STAGE": JSON.stringify(process.env.STAGE),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                process.env.FRAK_WALLET_URL
            ),
            "process.env.DEBUG": JSON.stringify(DEBUG.toString()),
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
            target: "baseline-widely-available",
            chunkSizeWarningLimit: 400,
            minify: true,
            sourcemap: !isProd,
            rolldownOptions: {
                treeshake: {
                    moduleSideEffects: "no-external",
                    propertyReadSideEffects: false,
                },
                optimization: {
                    inlineConst: { mode: "all", pass: 3 },
                },
                output: {
                    advancedChunks: {
                        minShareCount: 1,
                        groups: [
                            {
                                name: "react-vendor",
                                test: /node_modules[\\/](react|react-dom|scheduler|react-scan)/,
                                priority: 40,
                            },
                            {
                                name: "blockchain-vendor",
                                test: /node_modules[\\/](viem|0x|wagmi|@wagmi|permissionless|@noble|@scure)/,
                                priority: 35,
                            },
                            {
                                name: "ui-vendor",
                                test: /node_modules[\\/](@radix-ui|vaul|sonner|lucide-react|class-variance-authority)/,
                                priority: 30,
                            },
                            {
                                name: "router-vendor",
                                test: /node_modules[\\/]@tanstack[\\/]react-router/,
                                priority: 25,
                            },
                            {
                                name: "common",
                                priority: 10,
                            },
                        ],
                    },
                },
                onwarn,
            },
        },
        optimizeDeps: {
            exclude: ["react-scan"],
        },
    };
});
