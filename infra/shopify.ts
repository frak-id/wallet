import {
    backendUrl,
    businessUrl,
    indexerUrl,
    nexusRpcSecret,
    productSetupCodeSalt,
    shopifyApiKey,
    shopifyApiSecret,
    shopifyAppUrl,
    shopifyPostgresHost,
    shopifyPostgresPassword,
    walletUrl,
} from "./config";
import { isProd, normalizedStageName } from "./utils";

const shopifyEnv = {
    STAGE: normalizedStageName,
    FRAK_WALLET_URL: walletUrl,
    BUSINESS_URL: businessUrl,
    BACKEND_URL: backendUrl,
    INDEXER_URL: indexerUrl,
    POSTGRES_SHOPIFY_DB: isProd ? "shopify_prod" : "shopify_dev",
    POSTGRES_USER: isProd ? "shopify-prod" : "shopify-dev",
    SHOPIFY_APP_URL: isProd ? shopifyAppUrl : "http://localhost",
    SHOPIFY_API_KEY: shopifyApiKey,
};

const subdomain = isProd ? "extension-shop" : "extension-shop-dev";

new sst.aws.React("Shopify", {
    path: "apps/shopify",
    dev: {
        command: "bun run shopify:dev",
    },
    domain: {
        name: `${subdomain}.frak.id`,
    },
    environment: shopifyEnv,
    link: [
        shopifyPostgresHost,
        shopifyPostgresPassword,
        shopifyApiSecret,
        productSetupCodeSalt,
        nexusRpcSecret,
    ],
});
