import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    define: {
        "process.env.STAGE": JSON.stringify(process.env.STAGE),
        "process.env.FRAK_WALLET_URL": JSON.stringify(
            process.env.FRAK_WALLET_URL
        ),
        "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL),
    },
    server: {
        port: 3011,
    },
    plugins: [
        remix({
            future: {
                v3_fetcherPersist: true,
                v3_relativeSplatPath: true,
                v3_throwAbortReason: true,
                v3_singleFetch: true,
                v3_lazyRouteDiscovery: true,
                unstable_routeConfig: true,
            },
        }),
        tsconfigPaths(),
    ],
});
