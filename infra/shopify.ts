import {
    backendUrl,
    businessUrl,
    componentsUrl,
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

const isLocal = $dev ?? false;

const shopifyEnv = {
    STAGE: normalizedStageName,
    FRAK_WALLET_URL: walletUrl,
    BUSINESS_URL: businessUrl,
    BACKEND_URL: isProd
        ? "https://backend.frak.id"
        : "https://backend-dev.frak.id",
    FRAK_COMPONENTS_URL: componentsUrl,
    POSTGRES_SHOPIFY_DB: isProd ? "shopify_prod" : "shopify_dev",
    POSTGRES_USER: isProd ? "shopify-prod" : "shopify-dev",
    SHOPIFY_APP_URL: isLocal ? "http://localhost" : shopifyAppUrl,
    SHOPIFY_API_KEY: shopifyApiKey,
    SHOPIFY_POSTGRES_HOST: shopifyPostgresHost.value,
    SHOPIFY_POSTGRES_PASSWORD: shopifyPostgresPassword.value,
    SHOPIFY_API_SECRET: shopifyApiSecret.value,
    PRODUCT_SETUP_CODE_SALT: productSetupCodeSalt.value,
    NEXUS_RPC_SECRET: nexusRpcSecret.value,
};

const subdomain = isProd ? "extension-shop" : "extension-shop-dev";

new sst.aws.React("Shopify", {
    path: "apps/shopify",
    dev: {
        autostart: false,
        command: "bun run shopify:dev",
    },
    domain: {
        name: `${subdomain}.frak.id`,
    },
    environment: shopifyEnv,
});
