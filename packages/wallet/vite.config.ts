import { vitePlugin as remix } from "@remix-run/dev";
import { pick } from "radash";
import { Config } from "sst/node/config";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsconfigPaths from "vite-tsconfig-paths";

// Secret env variable from SST we want in the frontend
const wantedFromConfig: (keyof typeof Config)[] = [
    "STAGE",
    "ALCHEMY_API_KEY",
    "PIMLICO_API_KEY",
    "NEXUS_RPC_SECRET",
    "VAPID_PUBLIC_KEY",
    "BACKEND_URL",
    "INDEXER_URL",
];
const envFromSstConfig = pick(Config, wantedFromConfig);

declare module "@remix-run/node" {
    interface Future {
        v3_singleFetch: true;
    }
}

export default defineConfig({
    define: Object.fromEntries(
        Object.entries(envFromSstConfig).map(([key, value]) => [
            `process.env.${key}`,
            JSON.stringify(value),
        ])
    ),
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
                // v3_lazyRouteDiscovery: true,
            },
        }),
        mkcert(),
        tsconfigPaths(),
    ],
});
