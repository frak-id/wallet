import process from "node:process";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { lightningCssConfig, onwarn } from "../../packages/dev-tooling";


const isSandbox = !!process.env.SANDBOX;

/**
 * Get SST secret value - handles both sst dev (plain env) and sst shell (SST_RESOURCE_* JSON format)
 */
function getSstSecret(name: string): string | undefined {
    const plainValue = process.env[name];
    if (plainValue) return plainValue;

    const resourceValue = process.env[`SST_RESOURCE_${name}`];
    if (resourceValue) {
        try {
            const parsed = JSON.parse(resourceValue);
            return parsed.value;
        } catch (_) {
            return undefined;
        }
    }

    return undefined;
}

export default defineConfig({
    css: lightningCssConfig,
    plugins: [
        viteTsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        tanstackRouter({
            routesDirectory: "./src/routes",
            generatedRouteTree: "./src/routeTree.gen.ts",
            routeFileIgnorePattern: "test",
            autoCodeSplitting: true,
        }),
        viteReact(),
    ],
    resolve: {
        // Prefer production exports for smaller bundles when building
        conditions:
            process.env.NODE_ENV === "production"
                ? ["production", "default"]
                : ["development"],
    },
    // Replace some env variable when it's needed
    define: {
        "process.env.STAGE": JSON.stringify(process.env.STAGE),
        "process.env.FRAK_WALLET_URL": JSON.stringify(
            process.env.FRAK_WALLET_URL
        ),
        "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL),
        "process.env.ERPC_URL": JSON.stringify(process.env.ERPC_URL),
        "process.env.OPEN_PANEL_API_URL": JSON.stringify(
            process.env.OPEN_PANEL_API_URL
        ),
        "process.env.OPEN_PANEL_BUSINESS_CLIENT_ID": JSON.stringify(
            getSstSecret("OPEN_PANEL_BUSINESS_CLIENT_ID")
        ),
        "process.env.DRPC_API_KEY": JSON.stringify(
            getSstSecret("DRPC_API_KEY")
        ),
        "process.env.NEXUS_RPC_SECRET": JSON.stringify(
            getSstSecret("NEXUS_RPC_SECRET")
        ),
        "process.env.FUNDING_ON_RAMP_URL": JSON.stringify(
            getSstSecret("FUNDING_ON_RAMP_URL")
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
        port: 3022,
        allowedHosts: isSandbox ? true : undefined,
    },
});
