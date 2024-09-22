import { Config } from "sst/constructs";
import type { StackContext } from "sst/constructs";
import { getBackendUrl, getWalletUrl, isProdStack } from "./utils";

/**
 * Define the app wide configs
 * @param stack
 * @constructor
 */
export function ConfigStack({ stack }: StackContext) {
    const sessionEncryptionKey = new Config.Secret(
        stack,
        "SESSION_ENCRYPTION_KEY"
    );
    const mongoExampleUri = new Config.Secret(stack, "MONGODB_EXAMPLE_URI");
    const mongoNexusUri = new Config.Secret(stack, "MONGODB_NEXUS_URI");
    const mongoBusinessUri = new Config.Secret(stack, "MONGODB_BUSINESS_URI");
    const alchemyApiKey = new Config.Secret(stack, "ALCHEMY_API_KEY");
    const pimlicoApiKey = new Config.Secret(stack, "PIMLICO_API_KEY");
    const nexusRpcSecret = new Config.Secret(stack, "NEXUS_RPC_SECRET");
    const airdropPrivateKey = new Config.Secret(stack, "AIRDROP_PRIVATE_KEY");
    const contentMinterPrivateKey = new Config.Secret(
        stack,
        "CONTENT_MINTER_PRIVATE_KEY"
    );
    const adminPassword = new Config.Secret(stack, "ADMIN_PASSWORD");
    const worldNewsApiKey = new Config.Secret(stack, "WORLD_NEWS_API_KEY");

    const vapidPublicKey = new Config.Secret(stack, "VAPID_PUBLIC_KEY");
    const vapidPrivateKey = new Config.Secret(stack, "VAPID_PRIVATE_KEY");

    const nexusUrl = new Config.Parameter(stack, "NEXUS_WALLET_URL", {
        value: getWalletUrl(stack),
    });
    const backendUrl = new Config.Parameter(stack, "BACKEND_URL", {
        value: getBackendUrl(stack),
    });

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

    const indexerUrl = new Config.Parameter(stack, "INDEXER_URL", {
        value: isProdStack(stack)
            ? "https://indexer.frak.id"
            : "https://indexer-dev.frak.id",
    });

    return {
        indexerUrl,
        sessionEncryptionKey,
        mongoExampleUri,
        mongoNexusUri,
        mongoBusinessUri,
        alchemyApiKey,
        pimlicoApiKey,
        nexusRpcSecret,
        airdropPrivateKey,
        contentMinterPrivateKey,
        adminPassword,
        nexusUrl,
        worldNewsApiKey,
        vapidPublicKey,
        vapidPrivateKey,
        backendUrl,
        postgres,
    };
}
