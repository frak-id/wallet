import process from "node:process";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";
import {
    getSandboxEnv,
    getSstResource,
    lightningCssConfig,
    onwarn,
} from "../../packages/dev-tooling";

const isSandbox = !!process.env.ATELIER_SANDBOX_ID;

export default defineConfig(async () => {
    const sandboxEnv = await getSandboxEnv();

    return {
        css: lightningCssConfig,
        plugins: [
            tanstackRouter({
                routesDirectory: "./src/routes",
                generatedRouteTree: "./src/routeTree.gen.ts",
                routeFileIgnorePattern: "test",
                autoCodeSplitting: true,
            }),
            viteReact(),
        ],
        resolve: {
            tsconfigPaths: true,
            // Prefer production exports for smaller bundles when building
            conditions:
                process.env.NODE_ENV === "production"
                    ? ["production", "default"]
                    : ["development"],
        },
        // Replace some env variable when it's needed
        define: {
            "process.env.STAGE": JSON.stringify(getSstResource("STAGE")),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                sandboxEnv.walletUrl ?? getSstResource("FRAK_WALLET_URL")
            ),
            "process.env.BACKEND_URL": JSON.stringify(
                sandboxEnv.backendUrl ?? getSstResource("BACKEND_URL")
            ),
            "process.env.ERPC_URL": JSON.stringify(getSstResource("ERPC_URL")),
            "process.env.OPEN_PANEL_API_URL": JSON.stringify(
                getSstResource("OPEN_PANEL_API_URL")
            ),
            "process.env.OPEN_PANEL_BUSINESS_CLIENT_ID": JSON.stringify(
                getSstResource("OPEN_PANEL_BUSINESS_CLIENT_ID")
            ),
            "process.env.DRPC_API_KEY": JSON.stringify(
                getSstResource("DRPC_API_KEY")
            ),
            "process.env.NEXUS_RPC_SECRET": JSON.stringify(
                getSstResource("NEXUS_RPC_SECRET")
            ),
            "process.env.FUNDING_ON_RAMP_URL": JSON.stringify(
                getSstResource("FUNDING_ON_RAMP_URL")
            ),
            // Not placing mongo or session encryption key, that's only server side normally
        },
        build: {
            rolldownOptions: {
                output: {
                    advancedChunks: {
                        minShareCount: 2,
                        groups: [
                            {
                                name: "react-vendor",
                                test: /node_modules[\\/](react|react-dom|react[\\/]jsx-runtime)/,
                                priority: 40,
                            },
                            {
                                name: "blockchain-vendor",
                                test: /node_modules[\\/](viem|@noble|@scure)/,
                                priority: 35,
                            },
                            {
                                name: "tanstack-vendor",
                                test: /node_modules[\\/]@tanstack/,
                                priority: 32,
                            },
                            {
                                name: "ui-vendor",
                                test: /node_modules[\\/](@radix-ui|lucide-react|class-variance-authority|cmdk|react-hook-form)/,
                                priority: 30,
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
        server: {
            port: 3001,
            host: isSandbox ? "0.0.0.0" : "localhost",
            allowedHosts: isSandbox ? true : undefined,
        },
    } satisfies UserConfig;
});
