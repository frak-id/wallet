import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Secret env variable from SST we want in the frontend
const wantedFromEnv = [
    "STAGE",
    "ALCHEMY_API_KEY",
    "PIMLICO_API_KEY",
    "NEXUS_RPC_SECRET",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "BACKEND_URL",
    "INDEXER_URL",
];

declare module "@remix-run/node" {
    interface Future {
        v3_singleFetch: true;
    }
}

export default defineConfig({
    define: {
        ...Object.fromEntries(
            wantedFromEnv.map((key) => [
                `process.env.${key}`,
                JSON.stringify(process.env[key]),
            ])
        ),
    },
    server: {
        port: 3014,
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
        tsconfigPaths(),
    ],
});
