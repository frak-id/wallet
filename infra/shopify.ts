import {
    backendUrl,
    businessUrl,
    indexerUrl,
    isProd,
    postgresHost,
    postgresPassword,
    stage,
    walletUrl,
} from "./config.ts";

const shopifyEnv = {
    STAGE: stage,
    FRAK_WALLET_URL: walletUrl,
    BUSINESS_URL: businessUrl,
    BACKEND_URL: backendUrl,
    INDEXER_URL: indexerUrl,

    POSTGRES_SHOPIFY_DB: isProd ? "shopify_app" : "shopify_app_dev",
    POSTGRES_USER: isProd ? "backend" : "backend-dev",
};

// For now only a dev command
//  to deploy, we would need a remix app here, but we will see that later
if ($dev) {
    new sst.x.DevCommand("shopify:dev", {
        dev: {
            title: "Shopify App",
            autostart: false,
            command: "bun run dev",
            directory: "packages/shopify-app",
        },
        environment: shopifyEnv,
        link: [postgresHost, postgresPassword],
    });
}
