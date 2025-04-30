import { defineConfig } from "@rsbuild/core";
import { pluginReactRouter } from "rsbuild-plugin-react-router";

/**
 * Get the environment variables
 */
function getEnvToDefine() {
    return {
        "process.env.STAGE": JSON.stringify(process.env.STAGE),
        "process.env.BACKEND_URL": JSON.stringify(process.env.BACKEND_URL),
        "process.env.INDEXER_URL": JSON.stringify(process.env.INDEXER_URL),
        "process.env.ERPC_URL": JSON.stringify(process.env.ERPC_URL),
        "process.env.DRPC_API_KEY": JSON.stringify(process.env.DRPC_API_KEY),
        "process.env.PIMLICO_API_KEY": JSON.stringify(
            process.env.PIMLICO_API_KEY
        ),
        "process.env.NEXUS_RPC_SECRET": JSON.stringify(
            process.env.NEXUS_RPC_SECRET
        ),
        "process.env.VAPID_PUBLIC_KEY": JSON.stringify(
            process.env.VAPID_PUBLIC_KEY
        ),
        "process.env.UMAMI_WALLET_WEBSITE_ID": JSON.stringify(
            process.env.UMAMI_WALLET_WEBSITE_ID
        ),
        "process.env.PRIVY_APP_ID": JSON.stringify(process.env.PRIVY_APP_ID),
        "process.env.DEBUG": JSON.stringify(false),
        "process.env.APP_VERSION": JSON.stringify(
            process.env.COMMIT_HASH ?? "UNKNOWN"
        ),
        "process.env.FRAK_WALLET_URL": JSON.stringify(
            process.env.FRAK_WALLET_URL
        ),
    };
}

export default defineConfig(({ envMode }) => {
    console.log(envMode);

    return {
        source: {
            define: getEnvToDefine(),
            include: [
                // Include nprogress for compilation
                /node_modules[\\/]nprogress[\\/]/,
            ],
        },
        resolve: {
            alias: {
                "@/*": "./app/*",
                "@shared/*": "../../packages/shared/*",
                "@backend-utils": "../backend-elysia/src/utils/index.ts",
                "@backend-common": "../backend-elysia/src/common/index.ts",
                "@backend-common/*": "../backend-elysia/src/common/*",
            },
        },
        plugins: [
            pluginReactRouter({
                customServer: true,
            }),
            // pluginReact(),
            // pluginBasicSsl(),
        ],
    };
});
