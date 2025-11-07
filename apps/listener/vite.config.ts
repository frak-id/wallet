import * as process from "node:process";
import react from "@vitejs/plugin-react";
import type { Drop } from "esbuild";
import type { UserConfig } from "rolldown-vite";
import mkcert from "vite-plugin-mkcert";
import tsconfigPaths from "vite-tsconfig-paths";

const DEBUG = JSON.stringify(false);

export default {
    base: "/listener",
    resolve: {
        // CRITICAL: Use production conditions for tree shaking!
        // "development" loads full dev builds with debugging code
        conditions:
            process.env.NODE_ENV === "production"
                ? ["production", "default"]
                : ["development"],
    },
    define: {
        "process.env.STAGE": JSON.stringify(process.env.STAGE),
        "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL),
        "process.env.INDEXER_URL": JSON.stringify(process.env.INDEXER_URL),
        "process.env.ERPC_URL": JSON.stringify(process.env.ERPC_URL),
        "process.env.DRPC_API_KEY": JSON.stringify(process.env.DRPC_API_KEY),
        "process.env.PIMLICO_API_KEY": JSON.stringify(
            process.env.PIMLICO_API_KEY
        ),
        "process.env.NEXUS_RPC_SECRET": JSON.stringify(
            process.env.NEXUS_RPC_SECRET
        ),
        "process.env.DEBUG": JSON.stringify(DEBUG),
        "process.env.APP_VERSION": JSON.stringify(
            process.env.COMMIT_HASH ?? "UNKNOWN"
        ),
        "process.env.FRAK_WALLET_URL": JSON.stringify(
            process.env.FRAK_WALLET_URL
        ),
        "process.env.OPEN_PANEL_API_URL": JSON.stringify(
            process.env.OPEN_PANEL_API_URL
        ),
        "process.env.OPEN_PANEL_LISTENER_CLIENT_ID": JSON.stringify(
            process.env.OPEN_PANEL_LISTENER_CLIENT_ID
        ),
    },
    // Remove console and debugger on prod
    esbuild: {
        drop:
            process.env.STAGE === "prod"
                ? (["console", "debugger"] as Drop[])
                : [],
    },
    plugins: [react(), mkcert(), tsconfigPaths()],
    server: {
        port: 3002,
        proxy: {},
    },
    build: {
        cssCodeSplit: true,
        target: "baseline-widely-available",
        chunkSizeWarningLimit: 400,
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
                            // minSize: 30000,
                        },
                    ],
                },
            },
        },
        sourcemap: false,
    },
} satisfies UserConfig;
