import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import type { ConfigEnv, Plugin, UserConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tsconfigPaths from "vite-tsconfig-paths";

const hugeLibraries = [
    "@lottiefiles",
    "viem",
    "dexie",
    "vite-plugin-node-polyfills",
    "readable-stream",
    "browserify-rsa",
    "browserify-sign",
    "elliptic",
];

function manualChunks(id: string) {
    const lib = hugeLibraries.find((lib) => id.includes(`node_modules/${lib}`));
    if (lib) return lib;
}

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
    return {
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
            ...(mode === "production"
                ? [nodePolyfills() as Plugin]
                : ([] as Plugin[])),
            reactRouter(),
            tsconfigPaths(),
        ],
        build: {
            rollupOptions: {
                output: {
                    manualChunks,
                },
            },
        },
    };
});
