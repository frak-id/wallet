import { Config } from "sst/constructs";
import type { StackContext } from "sst/constructs";

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
    const mongoUri = new Config.Secret(stack, "MONGODB_FRAK_POC_URI");
    const alchemyApiKeys = new Config.Secret(stack, "ALCHEMY_API_KEYS");
    const pimlicoApiKey = new Config.Secret(stack, "PIMLICO_API_KEY");
    const zeroDevApiKey = new Config.Secret(stack, "ZERODEV_API_KEY");
    const airdropPrivateKey = new Config.Secret(stack, "AIRDROP_PRIVATE_KEY");
    const adminPassword = new Config.Secret(stack, "ADMIN_PASSWORD");

    const frakWalletUrl = new Config.Parameter(stack, "FRAK_WALLET_URL", {
        value:
            stack.stage === "prod"
                ? "https://poc-wallet.frak.id"
                : "http://localhost:3000",
    });

    return {
        sessionEncryptionKey,
        mongoUri,
        alchemyApiKeys,
        pimlicoApiKey,
        zeroDevApiKey,
        airdropPrivateKey,
        adminPassword,
        frakWalletUrl,
    };
}
