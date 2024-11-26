import { vitePlugin as remix } from "@remix-run/dev";
import { pick } from "radash";
import { Config } from "sst/node/config";
import { type UserConfig, defineConfig } from "vite";
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
        port: Number.parseInt(process.env.FRONTEND_PORT ?? "") ?? 8002,
        clientPort: 443,
    };
}

// Secret env variable from SST we want in the frontend
const wantedFromConfig: (keyof typeof Config)[] = [
    "POSTGRES_HOST",
    "POSTGRES_SHOPIFY_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "BACKEND_URL",
    "BUSINESS_URL",
    "FRAK_WALLET_URL",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

export default defineConfig({
    define: Object.fromEntries(
        Object.entries(envFromSstConfig).map(([key, value]) => [
            `process.env.${key}`,
            JSON.stringify(value),
        ])
    ),
    server: {
        port: Number(process.env.PORT || 3000),
        hmr: hmrConfig,
        fs: {
            // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
            allow: ["app", "node_modules"],
        },
    },
    plugins: [
        remix({
            ignoredRouteFiles: ["**/.*"],
        }),
        tsconfigPaths(),
    ],
    build: {
        assetsInlineLimit: 0,
    },
}) satisfies UserConfig;
