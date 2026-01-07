import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { lightningCssConfig } from "../../packages/dev-tooling";

export default defineConfig({
    css: {
        ...lightningCssConfig,
        modules: {
            localsConvention: "camelCase",
        },
    },
    build: {
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                // Use stable CSS filename for SSR (hash changes break deployment)
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith(".css")) {
                        return "assets/styles.css";
                    }
                    return "assets/[name].[hash][extname]";
                },
            },
        },
    },
    plugins: [
        viteTsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        tanstackStart({
            router: {
                routeFileIgnorePattern: "test",
            },
        }),
        viteReact(),
        nitro({ preset: "bun" }),
    ],
    // Replace some env variable when it's needed
    define: {
        "process.env.STAGE": JSON.stringify(process.env.STAGE),
        "process.env.FRAK_WALLET_URL": JSON.stringify(
            process.env.FRAK_WALLET_URL
        ),
        "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL),
        "process.env.INDEXER_URL": JSON.stringify(process.env.INDEXER_URL),
        "process.env.ERPC_URL": JSON.stringify(process.env.ERPC_URL),
        "process.env.OPEN_PANEL_API_URL": JSON.stringify(
            process.env.OPEN_PANEL_API_URL
        ),
        "process.env.OPEN_PANEL_BUSINESS_CLIENT_ID": JSON.stringify(
            process.env.OPEN_PANEL_BUSINESS_CLIENT_ID
        ),
        "process.env.DRPC_API_KEY": JSON.stringify(process.env.DRPC_API_KEY),
        "process.env.NEXUS_RPC_SECRET": JSON.stringify(
            process.env.NEXUS_RPC_SECRET
        ),
        "process.env.FUNDING_ON_RAMP_URL": JSON.stringify(
            process.env.FUNDING_ON_RAMP_URL
        ),
        // Not placing mongo or session encryption key, that's only server side normally
    },
});
