import process from "node:process";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";

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
            // Non-secret env vars — safe to bake at build time.
            // Secrets (DB password, API secret, salts) are read via
            // process.env at runtime in server code and NOT defined here.
            "process.env.STAGE": JSON.stringify(process.env.STAGE),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                process.env.FRAK_WALLET_URL
            ),
            "process.env.FRAK_COMPONENTS_URL": JSON.stringify(
                process.env.FRAK_COMPONENTS_URL
            ),
            "process.env.BUSINESS_URL": JSON.stringify(
                process.env.BUSINESS_URL
            ),
            "process.env.BACKEND_URL": JSON.stringify(
                process.env.BACKEND_URL
            ),
            "process.env.SHOPIFY_API_KEY": JSON.stringify(
                process.env.SHOPIFY_API_KEY
            ),
            "process.env.SHOPIFY_APP_URL": JSON.stringify(
                process.env.SHOPIFY_APP_URL
            ),
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
        plugins: [reactRouter()],
        resolve: {
            tsconfigPaths: true,
        },
        build: {
            assetsInlineLimit: 0,
        },
    } satisfies UserConfig;
});
