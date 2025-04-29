import * as process from "node:process";
import { reactRouter } from "@react-router/dev/vite";
import type { Drop } from "esbuild";
import { defineConfig } from "vite";
import type { ConfigEnv, UserConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsconfigPaths from "vite-tsconfig-paths";
import { manualChunks, onwarn } from "../shared/tooling/vite";

const DEBUG = JSON.stringify(false);

export default defineConfig(({ mode, isSsrBuild }: ConfigEnv): UserConfig => {
    const isSW = mode === "sw";

    const baseConfig = {
        define: {
            "process.env.STAGE": JSON.stringify(process.env.STAGE),
            "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL),
            "process.env.INDEXER_URL": JSON.stringify(process.env.INDEXER_URL),
            "process.env.ERPC_URL": JSON.stringify(process.env.ERPC_URL),
            "process.env.DRPC_API_KEY": JSON.stringify(
                process.env.DRPC_API_KEY
            ),
            "process.env.PIMLICO_API_KEY": JSON.stringify(
                process.env.PIMLICO_API_KEY
            ),
            "process.env.NEXUS_RPC_SECRET": JSON.stringify(
                process.env.NEXUS_RPC_SECRET
            ),
            "process.env.VAPID_PUBLIC_KEY": JSON.stringify(
                process.env.VAPID_PUBLIC_KEY
            ),
            "process.env.UMAMI_WALLET_WEBSITE_ID": JSON.stringify(
                process.env.UMAMI_WALLET_WEBSITE_ID
            ),
            "process.env.PRIVY_APP_ID": JSON.stringify(
                process.env.PRIVY_APP_ID
            ),
            "process.env.DEBUG": JSON.stringify(DEBUG),
            "process.env.APP_VERSION": JSON.stringify(
                process.env.COMMIT_HASH ?? "UNKNOWN"
            ),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                process.env.FRAK_WALLET_URL
            ),
        },
        // Remove console and debugger on prod
        esbuild: {
            drop:
                process.env.STAGE === "prod"
                    ? (["console", "debugger"] as Drop[])
                    : [],
        },
    };

    // Service worker configuration
    if (isSW) {
        return {
            ...baseConfig,
            plugins: [tsconfigPaths()],
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
        plugins: [reactRouter(), mkcert(), tsconfigPaths()],
        server: {
            port: 3000,
            proxy: {},
        },
        build: {
            cssCodeSplit: false,
            target: isSsrBuild ? "ES2022" : "ES2020",
            rollupOptions: {
                output: {
                    // Set a min chunk size to 16kb
                    // note, this is pre-minification chunk size, not the final bundle size
                    experimentalMinChunkSize: 32000,
                    manualChunks(id) {
                        return manualChunks(id);
                    },
                },
                onwarn,
            },
            sourcemap: false,
        },
        optimizeDeps: {
            exclude: ["react-scan"],
        },
    };
});
