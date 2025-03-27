import {
    drpcApiKey,
    erpcUrl,
    indexerUrl,
    nexusRpcSecret,
    pimlicoApiKey,
    sessionEncryptionKy,
    vapidPublicKey,
} from "../config";
import { isProd, normalizedStageName } from "../utils";
import { backendNamespace, domainName } from "./utils";

const dbInstance = $output(
    gcp.sql.getDatabaseInstance({
        name: `master-db-${normalizedStageName}`,
    })
);
const dbPassword = $output(
    gcp.secretmanager.getSecretVersion({
        secret: `wallet-backend-db-secret-${normalizedStageName}`,
    })
).apply((secret) => secret.secretData);

const masterPkey = $output(
    gcp.secretmanager.getSecretVersion({
        secret: `master-pkey-${isProd ? "prod" : "dev"}`,
    })
).apply((secret) => secret.secretData);

/**
 * All the secrets for the elysia instance
 * todo: KMS master key? Bedrock LLM?
 */
export const elysiaSecrets = new kubernetes.core.v1.Secret("elysia-secrets", {
    metadata: {
        name: `elysia-secrets-${normalizedStageName}`,
        namespace: backendNamespace.metadata.name,
    },
    type: "Opaque",
    stringData: {
        // Global
        STAGE: normalizedStageName,
        INDEXER_URL: indexerUrl,
        ERPC_URL: erpcUrl,
        DOMAIN_NAME: domainName,
        MASTER_KEY_SECRET_ID: masterPkey,
        // Postgres related
        POSTGRES_DB: "wallet-backend",
        POSTGRES_USER: `wallet-backend_${normalizedStageName}`,
        POSTGRES_PASSWORD: dbPassword,
        POSTGRES_HOST: dbInstance.privateIpAddress,

        // Mongo related
        MONGODB_EXAMPLE_URI: new sst.Secret("MONGODB_EXAMPLE_URI").value,
        MONGODB_NEXUS_URI: new sst.Secret("MONGODB_NEXUS_URI").value,

        // Sessions
        JWT_SECRET: new sst.Secret("JWT_SECRET").value,
        JWT_SDK_SECRET: new sst.Secret("JWT_SDK_SECRET").value,
        PRODUCT_SETUP_CODE_SALT: new sst.Secret("PRODUCT_SETUP_CODE_SALT")
            .value,
        SESSION_ENCRYPTION_KEY: sessionEncryptionKy.value,

        // Notifications
        VAPID_PUBLIC_KEY: vapidPublicKey.value,
        VAPID_PRIVATE_KEY: new sst.Secret("VAPID_PRIVATE_KEY").value,

        // API key's
        PIMLICO_API_KEY: pimlicoApiKey.value,
        DRPC_API_KEY: drpcApiKey.value,
        COIN_GECKO_API_KEY: new sst.Secret("COIN_GECKO_API_KEY").value,
        WORLD_NEWS_API_KEY: new sst.Secret("WORLD_NEWS_API_KEY").value,
        NEXUS_RPC_SECRET: nexusRpcSecret.value,
    },
});
