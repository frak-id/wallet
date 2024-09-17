import { createHmac } from "node:crypto";
import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { memo } from "radash";
import { Config } from "sst/node/config";
import { type Hex, hexToBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Build the repository that we will use to interface with our product signer
 */
export class ProductSignerRepository {
    private secretManager: SecretsManagerClient;

    constructor() {
        this.secretManager = new SecretsManagerClient({ region: "eu-west-1" });
    }

    /**
     * Get the master private key
     */
    public getMasterPrivateKey = memo(
        async () => {
            // Fetch the aws secret
            const secretValue = await this.secretManager.send(
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
        {
            key: () => "master-pkey",
        }
    );

    /**
     * Get an account specific to a product
     */
    public getProductSpecificAccount = memo(
        async ({ productId }: { productId: bigint }) => {
            // Get master private key
            const masterPrivateKey = await this.getMasterPrivateKey();
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
     * Get an account specific to a key
     */
    public getKeySpecificAccount = memo(
        async ({ key }: { key: "interaction-executor" | (string & {}) }) => {
            // Get master private key
            const masterPrivateKey = await this.getMasterPrivateKey();
            if (!masterPrivateKey) {
                throw new Error("Missing master private key");
            }

            // Derivative for random product
            const hmac = createHmac("sha256", hexToBytes(masterPrivateKey));
            hmac.update(key);
            const productPrivateKey = `0x${hmac.digest("hex")}` as Hex;

            // Return the account
            return privateKeyToAccount(productPrivateKey);
        },
        { key: ({ key }) => `key-account-${key}` }
    );
}
