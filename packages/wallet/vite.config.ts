import * as process from "node:process";
import { vitePlugin as remix } from "@remix-run/dev";
import { pick } from "radash";
import { Resource } from "sst";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
    interface Future {
        v3_singleFetch: true;
    }
}

/**
 * Some secrets wanted from SST during the build time
 */
const wantedFromConfig: (keyof typeof Resource)[] = [
    "ALCHEMY_API_KEY",
    "PIMLICO_API_KEY",
    "NEXUS_RPC_SECRET",
    "VAPID_PUBLIC_KEY",
    "UMAMI_WALLET_WEBSITE_ID",
];

export default defineConfig(({ isSsrBuild }) => {
    // Load some secrets from SST
    const sstSecrets = Object.entries(pick(Resource, wantedFromConfig)).map(
        ([key, obj]) => [
            `process.env.${key}`,
            JSON.stringify("value" in obj ? obj.value : obj),
        ]
    );

    // Return the built config
    return {
        define: {
            // Some env variables
            "process.env.STAGE": JSON.stringify(process.env.STAGE),
            "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL),
            "process.env.INDEXER_URL": JSON.stringify(process.env.INDEXER_URL),
            // Some secrets
            ...Object.fromEntries(sstSecrets),
        },
        server: {
            port: 3000,
            proxy: {},
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
            mkcert(),
            tsconfigPaths(),
        ],
        build: isSsrBuild ? { target: "ES2022" } : { target: "ES2020" },
    };
});
