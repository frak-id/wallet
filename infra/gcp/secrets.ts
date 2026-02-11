import {
    drpcApiKey,
    erpcUrl,
    jwtBusinessSecret,
    nexusRpcSecret,
    pimlicoApiKey,
    vapidPublicKey,
} from "../config";
import { isProd, isV2, normalizedStageName } from "../utils";

const dbStage = normalizedStageName === "production" ? "production" : "staging";

// PostgreSQL schema: staging_v2, production_v2 for V2; public for V1
const postgresSchema = isV2 ? `${dbStage}_v2` : "public";

// Get Some db parameters
export const dbInstance = $output(
    gcp.sql.getDatabaseInstance({
        name: `master-db-${dbStage}`,
    })
);
const dbPassword = $output(
    gcp.secretmanager.getSecretVersion({
        secret: `wallet-backend-db-secret-${dbStage}`,
    })
).apply((secret) => secret.secretData);

const masterPkey = $output(
    gcp.secretmanager.getSecretVersion({
        secret: `master-pkey-${isProd ? "prod" : "dev"}`,
    })
).apply((secret) => secret.secretData);

export const postgresEnv = {
    POSTGRES_DB: "wallet-backend",
    POSTGRES_USER: `wallet-backend_${dbStage}`,
    POSTGRES_PASSWORD: dbPassword,
    POSTGRES_HOST: dbInstance.privateIpAddress,
    POSTGRES_SCHEMA: postgresSchema,
};

export const elysiaEnv = {
    // Global
    STAGE: normalizedStageName,
    ERPC_URL: erpcUrl,
    MASTER_KEY_SECRET: masterPkey,
    // Postgres related
    ...postgresEnv,

    // Mongo related
    MONGODB_NEXUS_URI: new sst.Secret("MONGODB_NEXUS_URI").value,

    // Sessions
    JWT_SECRET: new sst.Secret("JWT_SECRET").value,
    JWT_SDK_SECRET: new sst.Secret("JWT_SDK_SECRET").value,
    JWT_BUSINESS_SECRET: jwtBusinessSecret.value,
    PRODUCT_SETUP_CODE_SALT: new sst.Secret("PRODUCT_SETUP_CODE_SALT").value,

    // Notifications
    VAPID_PUBLIC_KEY: vapidPublicKey.value,
    VAPID_PRIVATE_KEY: new sst.Secret("VAPID_PRIVATE_KEY").value,

    // API key's
    PIMLICO_API_KEY: pimlicoApiKey.value,
    DRPC_API_KEY: drpcApiKey.value,
    COIN_GECKO_API_KEY: new sst.Secret("COIN_GECKO_API_KEY").value,
    WORLD_NEWS_API_KEY: new sst.Secret("WORLD_NEWS_API_KEY").value,
    NEXUS_RPC_SECRET: nexusRpcSecret.value,
    AIRTABLE_API_KEY: new sst.Secret("AIRTABLE_API_KEY").value,
    SLACK_BOT_TOKEN: new sst.Secret("SLACK_BOT_TOKEN").value,

    // Shopify related
    SHOPIFY_API_SECRET: new sst.Secret("SHOPIFY_API_SECRET").value,

    // Mobile
    ANDROID_SHA256_FINGERPRINT: new sst.Secret("ANDROID_SHA256_FINGERPRINT")
        .value,
};
