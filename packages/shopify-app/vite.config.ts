import process from "node:process";
import { vitePlugin as remix } from "@remix-run/dev";
import { pick } from "radash";
import { Resource } from "sst";
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
const wantedFromConfig: (keyof typeof Resource)[] = [
    "POSTGRES_HOST",
    "POSTGRES_PASSWORD",
];

declare module "@remix-run/node" {
    interface Future {
        v3_singleFetch: true;
    }
}

export default defineConfig(() => {
    // Load some secrets from SST
    const sstSecrets = Object.entries(pick(Resource, wantedFromConfig)).map(
        ([key, obj]) => [
            `process.env.${key}`,
            JSON.stringify("value" in obj ? obj.value : obj),
        ]
    );

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
            ...Object.fromEntries(sstSecrets),
        },
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
                future: {
                    v3_fetcherPersist: true,
                    v3_relativeSplatPath: true,
                    v3_throwAbortReason: true,
                    v3_singleFetch: true,
                    v3_lazyRouteDiscovery: true,
                    v3_routeConfig: true,
                },
            }),
            tsconfigPaths(),
        ],
        build: {
            assetsInlineLimit: 0,
        },
    } satisfies UserConfig;
});
