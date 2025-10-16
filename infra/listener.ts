import {
    backendUrl,
    drpcApiKey,
    erpcUrl,
    indexerUrl,
    nexusRpcSecret,
    openPanelApiUrl,
    // openPanelListenerClientId, // TODO: Uncomment when ready to deploy
    pimlicoApiKey,
    walletUrl,
} from "./config";
// import { walletRouter } from "./wallet"; // TODO: Will be used when Router approach is enabled

/**
 * Listener iframe app (will be served at /listener path via WalletRouter)
 *
 * TODO: This infrastructure is ready but commented out in sst.config.ts
 * Uncomment when ready to deploy after merge to main.
 */
export const listener = new sst.aws.StaticSite("Listener", {
    path: "apps/listener",
    // TODO: When ready to deploy, use Router instead of standalone domain
    // router: {
    //     instance: walletRouter,
    //     path: "/listener",
    // },
    build: {
        command: "bun run build",
        output: "build/client",
    },
    vite: {
        types: "./sst-env.d.ts",
    },
    // Environment variables
    environment: {
        STAGE: $app.stage,
        BACKEND_URL: backendUrl,
        INDEXER_URL: indexerUrl,
        ERPC_URL: erpcUrl,
        DRPC_API_KEY: drpcApiKey.value,
        PIMLICO_API_KEY: pimlicoApiKey.value,
        NEXUS_RPC_SECRET: nexusRpcSecret.value,
        FRAK_WALLET_URL: walletUrl,
        OPEN_PANEL_API_URL: openPanelApiUrl,
        // OPEN_PANEL_LISTENER_CLIENT_ID: openPanelListenerClientId.value, // TODO: Uncomment when secret is set
    },
});
