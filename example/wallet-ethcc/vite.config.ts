import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import type { ConfigEnv, Plugin, UserConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
    return {
        define: {
            "process.env.STAGE": JSON.stringify(process.env.STAGE),
            "process.env.FRAK_WALLET_URL": JSON.stringify(
                process.env.FRAK_WALLET_URL
            ),
        },
        server: {
            port: 3012,
        },
        plugins: [
            ...(mode === "production"
                ? [nodePolyfills() as Plugin]
                : ([] as Plugin[])),
            reactRouter(),
            tsconfigPaths(),
        ],
    };
});
