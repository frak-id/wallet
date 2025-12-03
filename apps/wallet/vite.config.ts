import * as process from "node:process";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import type { ConfigEnv, UserConfig } from "rolldown-vite";
import { defineConfig } from "rolldown-vite";
import mkcert from "vite-plugin-mkcert";
import removeConsole from "vite-plugin-remove-console";
import tsconfigPaths from "vite-tsconfig-paths";
import { lightningCssConfig, onwarn } from "../../packages/dev-tooling";

const DEBUG = JSON.stringify(false);

const isProd = process.env.STAGE?.includes("prod") ?? false;
const isTauri = !!process.env.TAURI_CLI_RUNNING;

/**
 * Get SST secret value - handles both sst dev (plain env) and sst shell (SST_RESOURCE_* JSON format)
 */
function getSstSecret(name: string): string | undefined {
    // First check plain env var (from sst dev)
    const plainValue = process.env[name];
    if (plainValue) return plainValue;

    // Then check SST resource format (from sst shell)
    const resourceValue = process.env[`SST_RESOURCE_${name}`];
    if (resourceValue) {
        try {
            const parsed = JSON.parse(resourceValue);
            return parsed.value;
        } catch {
            return undefined;
        }
    }

    return undefined;
}

/**
 * Get env var with fallback for Tauri builds (sst shell doesn't provide non-secret env vars)
 */
function getEnvWithFallback(name: string, fallback: string): string {
    return process.env[name] ?? fallback;
}

export default defineConfig(({ mode, command }: ConfigEnv): UserConfig => {
    const isSW = mode === "sw";

    const baseConfig = {
        clearScreen: false,
        envPrefix: ["VITE_", "TAURI_"],
        define: {
            "process.env.STAGE": JSON.stringify(
                getEnvWithFallback("STAGE", "dev")
            ),
            "process.env.BACKEND_URL": JSON.stringify(
                getEnvWithFallback("BACKEND_URL", "https://backend.gcp-dev.frak.id")
            ),
            "process.env.INDEXER_URL": JSON.stringify(
                getEnvWithFallback("INDEXER_URL", "https://ponder.gcp-dev.frak.id")
            ),
            "process.env.ERPC_URL": JSON.stringify(
                getEnvWithFallback("ERPC_URL", "https://erpc.gcp-dev.frak.id/nexus-rpc/evm/")
            ),
            "process.env.DRPC_API_KEY": JSON.stringify(
                getSstSecret("DRPC_API_KEY")
            ),
            "process.env.PIMLICO_API_KEY": JSON.stringify(
                getSstSecret("PIMLICO_API_KEY")
            ),
            "process.env.NEXUS_RPC_SECRET": JSON.stringify(
                getSstSecret("NEXUS_RPC_SECRET")
            ),
            "process.env.VAPID_PUBLIC_KEY": JSON.stringify(
                getSstSecret("VAPID_PUBLIC_KEY")
            ),
            "process.env.DEBUG": JSON.stringify(DEBUG),
            "process.env.APP_VERSION": JSON.stringify(
                process.env.COMMIT_HASH ?? "UNKNOWN"
            ),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                getEnvWithFallback("FRAK_WALLET_URL", "https://wallet-dev.frak.id")
            ),
            "process.env.OPEN_PANEL_API_URL": JSON.stringify(
                getEnvWithFallback("OPEN_PANEL_API_URL", "https://op-api.gcp.frak.id")
            ),
            "process.env.OPEN_PANEL_WALLET_CLIENT_ID": JSON.stringify(
                getSstSecret("OPEN_PANEL_WALLET_CLIENT_ID")
            ),
        },
    };

    // Service worker configuration
    if (isSW) {
        return {
            ...baseConfig,
            plugins: [tsconfigPaths()],
            publicDir: false,
            build: {
                target: "ES2020",
                lib: {
                    name: "WalletServiceWorker",
                    entry: "./app/service-worker.ts",
                    formats: ["iife"],
                    fileName: () => "sw.js",
                },
                outDir: "public",
                emptyOutDir: false,
            },
        };
    }

    // Wallet app configuration
    return {
        ...baseConfig,
        css: lightningCssConfig,
        plugins: [
            tanstackRouter({
                routesDirectory: "./app/routes",
                generatedRouteTree: "./app/routeTree.gen.ts",
                autoCodeSplitting: true,
            }),
            viteReact(),
            // Skip HTTPS for Tauri dev (mobile simulators don't trust self-signed certs)
            ...(isTauri ? [] : [mkcert()]),
            tsconfigPaths(),
            ...(isProd ? [removeConsole()] : []),
        ],
        resolve: {
            conditions: ["development"],
            alias: {
                // Enforce stub for @wagmi/connectors to avoid heavy dependencies (MetaMask SDK, etc.)
                "@wagmi/connectors": new URL(
                    "../../.stubs/wagmi-connectors-stub/index.js",
                    import.meta.url
                ).pathname,
                ...(command === "build"
                    ? {
                          "react-dom/server": "react-dom/server.node",
                      }
                    : {}),
            },
        },
        server: {
            port: 3000,
            // For Tauri dev: tell Vite the host so HMR WebSocket can connect
            host: isTauri ? "0.0.0.0" : "localhost",
            // Enable HMR for Tauri by explicitly setting the WebSocket URL
            hmr: isTauri
                ? {
                      protocol: "ws",
                      host: "localhost",
                      port: 3000,
                  }
                : undefined,
            proxy: {
                // Proxy listener app from separate dev server
                "/listener": {
                    target: "https://localhost:3002",
                    changeOrigin: true,
                    secure: false, // Allow self-signed certs in dev
                    ws: true, // Proxy websockets if needed
                },
            },
            watch: {
                // Tell vite to ignore watching `src-tauri`
                ignored: ["**/src-tauri/**"],
            },
        },
        build: {
            // CSS code splitting - keep enabled for better caching
            cssCodeSplit: false,
            target: "baseline-widely-available",
            // Chunk size warning limit - we're optimizing chunks to stay under this
            chunkSizeWarningLimit: 400,
            minify: true,
            sourcemap: !isProd,
            rolldownOptions: {
                // Enable aggressive tree shaking
                treeshake: {
                    moduleSideEffects: "no-external", // External packages (node_modules) have no side effects
                    propertyReadSideEffects: false, // Reading properties doesn't cause side effects
                },
                optimization: {
                    // This will to remove some stuff that will be defined, like stage depend variable
                    inlineConst: { mode: "all", pass: 3 },
                },
                output: {
                    advancedChunks: {
                        // Only chunk stuff shared by at least 2 module
                        minShareCount: 2,
                        groups: [
                            // React ecosystem - React + React-DOM + scheduler
                            {
                                name: "react-vendor",
                                test: /node_modules[\\/](react|react-dom|react[\\/]jsx-runtime)/,
                                priority: 40,
                            },

                            // Blockchain libraries - viem + wagmi + all crypto
                            {
                                name: "blockchain-vendor",
                                test: /node_modules[\\/](viem|0x|wagmi|@wagmi|permissionless|@noble|@scure)/,
                                priority: 35,
                            },

                            // UI vendors - ALL UI libraries together
                            {
                                name: "ui-vendor",
                                test: /node_modules[\\/](@radix-ui|vaul|micromark|sonner|lucide-react|class-variance-authority|cuer|nprogress|react-hook-form|react-dropzone)/,
                                priority: 30,
                            },

                            // All the other elements shared within the codebase
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
