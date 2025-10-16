import * as process from "node:process";
import { reactRouter } from "@react-router/dev/vite";
import type { Drop } from "esbuild";
import type { ConfigEnv, UserConfig } from "vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsconfigPaths from "vite-tsconfig-paths";
import { manualChunks, onwarn } from "../../packages/dev-tooling";

const DEBUG = JSON.stringify(false);

export default defineConfig(({ isSsrBuild }: ConfigEnv): UserConfig => {
    return {
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
        plugins: [reactRouter(), mkcert(), tsconfigPaths()],
        resolve: {
            conditions: ["development"],
        },
        server: {
            port: 3001,
            proxy: {},
        },
        build: {
            cssCodeSplit: true,
            target: isSsrBuild ? "ES2022" : "ES2020",
            rollupOptions: {
                output: {
                    experimentalMinChunkSize: 32000,
                    manualChunks(id, meta) {
                        return manualChunks(id, meta);
                    },
                },
                onwarn,
            },
            sourcemap: false,
        },
    };
});
