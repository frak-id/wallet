import * as process from "node:process";
import react from "@vitejs/plugin-react";
import type { Drop } from "esbuild";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsconfigPaths from "vite-tsconfig-paths";
import { manualChunks, onwarn } from "../../packages/dev-tooling";

const DEBUG = JSON.stringify(false);

export default defineConfig((): UserConfig => {
    return {
        base: "/listener",
        resolve: {
            conditions: ["development"],
            alias: {
                "@simplewebauthn/server": new URL(
                    "./app/module/utils/webauthn/serverShim.ts",
                    import.meta.url
                ).pathname,
            },
        },
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
        plugins: [react(), mkcert(), tsconfigPaths()],
        server: {
            port: 3002,
            proxy: {},
        },
        build: {
            cssCodeSplit: true,
            target: "ES2020",
            rollupOptions: {
                output: {
                    // Reduce chunk size threshold to encourage more splitting
                    experimentalMinChunkSize: 20000,
                    manualChunks(id, meta) {
                        // Vendor chunk mapping for listener app
                        const vendorChunks = [
                            {
                                name: "vendor-react",
                                patterns: [
                                    "node_modules/react/",
                                    "node_modules/react-dom/",
                                ],
                            },
                            {
                                name: "vendor-query",
                                patterns: [
                                    "node_modules/@tanstack/react-query",
                                    "node_modules/@tanstack/query-core",
                                ],
                            },
                            {
                                name: "vendor-jotai",
                                patterns: ["node_modules/jotai"],
                            },
                            {
                                name: "vendor-aa",
                                patterns: [
                                    "node_modules/permissionless",
                                    "node_modules/@aa-sdk",
                                ],
                            },
                            {
                                name: "vendor-viem",
                                patterns: [
                                    "node_modules/viem",
                                    "node_modules/ox",
                                ],
                            },
                            {
                                name: "vendor-webauthn",
                                patterns: [
                                    "node_modules/@simplewebauthn",
                                    "node_modules/@peculiar",
                                ],
                            },
                        ];

                        for (const chunk of vendorChunks) {
                            if (
                                chunk.patterns.some((pattern) =>
                                    id.includes(pattern)
                                )
                            ) {
                                return chunk.name;
                            }
                        }

                        return manualChunks(id, meta);
                    },
                },
                onwarn,
            },
            sourcemap: false,
        },
    };
});
