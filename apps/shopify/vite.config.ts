import process from "node:process";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the remix server. The CLI will eventually
// stop passing in HOST, so we can remove this workaround after the next major release.
if (
    process.env.HOST &&
    (!process.env.SHOPIFY_APP_URL ||
        process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
    process.env.SHOPIFY_APP_URL = process.env.HOST;
    process.env.HOST = undefined;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
    .hostname;

let hmrConfig: {
    protocol: string;
    host: string;
    port: number;
    clientPort: number;
};
if (host === "localhost") {
    hmrConfig = {
        protocol: "ws",
        host: "localhost",
        port: 64999,
        clientPort: 64999,
    };
} else {
    hmrConfig = {
        protocol: "wss",
        host: host,
        port: Number.parseInt(process.env.FRONTEND_PORT ?? "", 10) ?? 8002,
        clientPort: 443,
    };
}

export default defineConfig(() => {
    return {
        define: {
            "process.env.STAGE": JSON.stringify(process.env.STAGE),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                process.env.FRAK_WALLET_URL
            ),
            "process.env.BUSINESS_URL": JSON.stringify(
                process.env.BUSINESS_URL
            ),
            "process.env.BACKEND_URL": JSON.stringify(
                process.env.BACKEND_URL?.startsWith("http://localhost")
                    ? "https://backend-dev.frak.id"
                    : process.env.BACKEND_URL
            ),
            "process.env.INDEXER_URL": JSON.stringify(process.env.INDEXER_URL),
            "process.env.POSTGRES_USER": JSON.stringify(
                process.env.POSTGRES_USER
            ),
            "process.env.POSTGRES_SHOPIFY_DB": JSON.stringify(
                process.env.POSTGRES_SHOPIFY_DB
            ),
            "process.env.SHOPIFY_POSTGRES_HOST": JSON.stringify(
                process.env.SHOPIFY_POSTGRES_HOST
            ),
            "process.env.SHOPIFY_POSTGRES_PASSWORD": JSON.stringify(
                process.env.SHOPIFY_POSTGRES_PASSWORD
            ),
            "process.env.SHOPIFY_API_KEY": JSON.stringify(
                process.env.SHOPIFY_API_KEY
            ),
            "process.env.SHOPIFY_APP_URL": JSON.stringify(
                process.env.SHOPIFY_APP_URL
            ),
            "process.env.SHOPIFY_API_SECRET": JSON.stringify(
                process.env.SHOPIFY_API_SECRET
            ),
            "process.env.PRODUCT_SETUP_CODE_SALT": JSON.stringify(
                process.env.PRODUCT_SETUP_CODE_SALT
            ),
            "process.env.RPC_SECRET": JSON.stringify(process.env.RPC_SECRET),
        },
        server: {
            port: Number(process.env.PORT || 3000),
            hmr: hmrConfig,
            fs: {
                // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
                allow: ["app", "node_modules"],
            },
            allowedHosts: true,
        },
        plugins: [reactRouter(), tsconfigPaths()],
        build: {
            assetsInlineLimit: 0,
        },
    } satisfies UserConfig;
});
