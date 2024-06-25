import { Config } from "sst/constructs";
import type { StackContext } from "sst/constructs";
import { getWalletUrl } from "./utils";

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
    const mongoNexusUri = new Config.Secret(stack, "MONGODB_NEXUS_URI");
    const alchemyApiKey = new Config.Secret(stack, "ALCHEMY_API_KEY");
    const pimlicoApiKey = new Config.Secret(stack, "PIMLICO_API_KEY");
    const zeroDevApiKey = new Config.Secret(stack, "ZERODEV_API_KEY");
    const airdropPrivateKey = new Config.Secret(stack, "AIRDROP_PRIVATE_KEY");
    const interactionValidatorPrivateKey = new Config.Secret(
        stack,
        "INTERACTION_VALIDATOR_PRIVATE_KEY"
    );
    const adminPassword = new Config.Secret(stack, "ADMIN_PASSWORD");
    const walletconnectProjectId = new Config.Secret(
        stack,
        "WALLETCONNECT_PROJECT_ID"
    );

    const nexusUrl = new Config.Parameter(stack, "NEXUS_WALLET_URL", {
        value: getWalletUrl(stack),
    });

    return {
        sessionEncryptionKey,
        mongoUri,
        mongoNexusUri,
        alchemyApiKey,
        pimlicoApiKey,
        zeroDevApiKey,
        airdropPrivateKey,
        interactionValidatorPrivateKey,
        adminPassword,
        nexusUrl,
        walletconnectProjectId,
    };
}
