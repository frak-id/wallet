import { createHmac } from "node:crypto";
import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { memo } from "radash";
import { Config } from "sst/node/config";
import { type Hex, hexToBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Get our secret manager
const secretManager = new SecretsManagerClient({ region: "eu-west-1" });

/**
 * Get the master private key
 */
const getMasterPrivateKey = memo(
    async () => {
        // Fetch the aws secret
        const secretValue = await secretManager.send(
            new GetSecretValueCommand({
                SecretId: Config.MASTER_KEY_SECRET_ID,
            })
        );
        if (!secretValue.SecretString) {
            throw new Error("Unable to find the secret string");
        }

        // Parse the secret
        const parsedSecret = JSON.parse(secretValue.SecretString) as {
            masterPrivateKey: string;
        };
        if (!parsedSecret.masterPrivateKey) {
            throw new Error("Missing masterPrivateKey in the secret");
        }

        // Parse it in a readable hex format
        return `0x${parsedSecret.masterPrivateKey}` as Hex;
    },
    { key: () => "master-pkey" }
);

/**
 * Init our product signer, this will permit early exit in case of anything missing
 */
export async function initProductInteractionSigner() {
    await getMasterPrivateKey();
}

/**
 * Get an account specific to a product
 * @param productId
 */
export const getProductSpecificAccount = memo(
    async ({ productId }: { productId: bigint }) => {
        // Get master private key
        const masterPrivateKey = await getMasterPrivateKey();
        if (!masterPrivateKey) {
            throw new Error("Missing master private key");
        }

        // Derivative for random product
        const hmac = createHmac("sha256", hexToBytes(masterPrivateKey));
        hmac.update(toHex(productId));
        const productPrivateKey = `0x${hmac.digest("hex")}` as Hex;

        // Return the account
        return privateKeyToAccount(productPrivateKey);
    },
    { key: ({ productId }) => `product-account-${toHex(productId)}` }
);

/**
 * Get the interaction executor account
 */
export const getInteractionExecutorAccount = memo(
    async () => {
        // Get master private key
        const masterPrivateKey = await getMasterPrivateKey();
        if (!masterPrivateKey) {
            throw new Error("Missing master private key");
        }

        // Derivative for random product
        const hmac = createHmac("sha256", hexToBytes(masterPrivateKey));
        hmac.update("interaction-executor");
        const productPrivateKey = `0x${hmac.digest("hex")}` as Hex;

        // Return the account
        return privateKeyToAccount(productPrivateKey);
    },
    { key: () => "interaction-executor-account" }
);
