import * as process from "node:process";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import type { ConfigEnv, UserConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsconfigPaths from "vite-tsconfig-paths";
import { manualChunks, onwarn } from "../shared/tooling/vite";

const DEBUG = JSON.stringify(false);

export default defineConfig(({ isSsrBuild }: ConfigEnv): UserConfig => {
    // Return the built config
    return {
        define: {
            // Some env variables
            "process.env.STAGE": JSON.stringify(process.env.STAGE),
            "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL),
            "process.env.INDEXER_URL": JSON.stringify(process.env.INDEXER_URL),
            "process.env.ALCHEMY_API_KEY": JSON.stringify(
                process.env.ALCHEMY_API_KEY
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
        },
        server: {
            port: 3000,
            proxy: {},
        },
        // Remove console and debugger on prod
        esbuild: {
            drop: process.env.STAGE === "prod" ? ["console", "debugger"] : [],
        },
        plugins: [reactRouter(), mkcert(), tsconfigPaths()],
        build: {
            target: isSsrBuild ? "ES2022" : "ES2020",
            rollupOptions: {
                output: {
                    // Set a min chunk size to 16kb
                    // note, this is pre-minification chunk size, not the final bundle size
                    experimentalMinChunkSize: 16384,
                    manualChunks(id) {
                        return manualChunks(id);
                    },
                },
                onwarn,
            },
            sourcemap: process.env.STAGE !== "prod",
        },
        optimizeDeps: {
            exclude: ["react-scan"],
        },
    };
});
