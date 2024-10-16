import { Config } from "sst/constructs";
import type { StackContext } from "sst/constructs";
import { getBackendUrl, getWalletUrl, isProdStack } from "./utils";

/**
 * Define the app wide configs
 * @param stack
 * @constructor
 */
export function ConfigStack({ stack }: StackContext) {
    // Some secrets
    const sessionEncryptionKey = new Config.Secret(
        stack,
        "SESSION_ENCRYPTION_KEY"
    );
    const jwtSecret = new Config.Secret(stack, "JWT_SECRET");
    const jwtSdkSecret = new Config.Secret(stack, "JWT_SDK_SECRET");
    const setupCodeSalt = new Config.Secret(stack, "PRODUCT_SETUP_CODE_SALT");

    // Db related
    const mongoExampleUri = new Config.Secret(stack, "MONGODB_EXAMPLE_URI");
    const mongoNexusUri = new Config.Secret(stack, "MONGODB_NEXUS_URI");
    const mongoBusinessUri = new Config.Secret(stack, "MONGODB_BUSINESS_URI");
    const postgres = {
        host: new Config.Secret(stack, "POSTGRES_HOST"),
        user: new Config.Parameter(stack, "POSTGRES_USER", {
            value: isProdStack(stack) ? "backend" : "backend-dev",
        }),
        password: new Config.Secret(stack, "POSTGRES_PASSWORD"),
        db: new Config.Parameter(stack, "POSTGRES_DB", {
            value: isProdStack(stack) ? "backend" : "backend_dev",
        }),
    };

    // External api related
    const alchemyApiKey = new Config.Secret(stack, "ALCHEMY_API_KEY");
    const pimlicoApiKey = new Config.Secret(stack, "PIMLICO_API_KEY");
    const nexusRpcSecret = new Config.Secret(stack, "NEXUS_RPC_SECRET");
    const coinGeckoApiKey = new Config.Secret(stack, "COIN_GECKO_API_KEY");
    const worldNewsApiKey = new Config.Secret(stack, "WORLD_NEWS_API_KEY");

    // Example website related
    const adminPassword = new Config.Secret(stack, "ADMIN_PASSWORD");

    // Notification related
    const vapidPublicKey = new Config.Secret(stack, "VAPID_PUBLIC_KEY");
    const vapidPrivateKey = new Config.Secret(stack, "VAPID_PRIVATE_KEY");

    // Web services url related
    const frakWalletUrl = new Config.Parameter(stack, "FRAK_WALLET_URL", {
        value: getWalletUrl(stack),
    });
    const backendUrl = new Config.Parameter(stack, "BACKEND_URL", {
        value: getBackendUrl(stack),
    });
    const indexerUrl = new Config.Parameter(stack, "INDEXER_URL", {
        value: isProdStack(stack)
            ? "https://indexer.frak.id"
            : "https://indexer-dev.frak.id",
    });

    return {
        indexerUrl,
        setupCodeSalt,
        sessionEncryptionKey,
        jwtSecret,
        jwtSdkSecret,
        mongoExampleUri,
        mongoNexusUri,
        mongoBusinessUri,
        alchemyApiKey,
        coinGeckoApiKey,
        pimlicoApiKey,
        nexusRpcSecret,
        adminPassword,
        frakWalletUrl,
        worldNewsApiKey,
        vapidPublicKey,
        vapidPrivateKey,
        backendUrl,
        postgres,
    };
}
