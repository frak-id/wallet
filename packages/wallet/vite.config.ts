import * as process from "node:process";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ isSsrBuild }) => {
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
        build: isSsrBuild ? { target: "ES2022" } : { target: "ES2020" },
    };
});
