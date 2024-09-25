import { createHmac } from "node:crypto";
import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { LRUCache } from "lru-cache";
import { Config } from "sst/node/config";
import { type Hex, hexToBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Build the repository that we will use to interface with our different wallets
 */
export class AdminWalletsRepository {
    private secretManager: SecretsManagerClient;

    // biome-ignore lint/complexity/noBannedTypes: idk how to type this
    constructor(private readonly cache: LRUCache<string, {}>) {
        this.secretManager = new SecretsManagerClient({ region: "eu-west-1" });
    }

    /**
     * Get a value from cache or fetch it
     */
    private async getFromCacheOrFetch(
        key: string,
        fetcher: () => Promise<Hex>
    ): Promise<Hex> {
        const cacheKey = `ProductSignerRepository-${key}`;
        const cachedValue = this.cache.get(cacheKey);
        if (cachedValue) {
            return cachedValue as Hex;
        }
        const fetchedValue = await fetcher();
        this.cache.set(cacheKey, fetchedValue);
        return fetchedValue;
    }

    /**
     * Get the master private key
     */
    private async getMasterPrivateKey() {
        return this.getFromCacheOrFetch("master-pkey", async () => {
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

            // Parse it in a readable hex format and return it
            return `0x${parsedSecret.masterPrivateKey}` as Hex;
        });
    }

    /**
     * Get a derived key from the master private key
     */
    private async getDerivedKey(key: string) {
        return this.getFromCacheOrFetch(`derived-key-${key}`, async () => {
            // Get master private key
            const masterPrivateKey = await this.getMasterPrivateKey();
            if (!masterPrivateKey) {
                throw new Error("Missing master private key");
            }

            // Derivative for random product
            const hmac = createHmac("sha256", hexToBytes(masterPrivateKey));
            hmac.update(key);
            return `0x${hmac.digest("hex")}` as Hex;
        });
    }

    /**
     * Get an account specific to a product
     */
    public async getProductSpecificAccount({
        productId,
    }: { productId: bigint }) {
        const pkey = await this.getDerivedKey(toHex(productId));
        return privateKeyToAccount(pkey);
    }

    /**
     * Get an account specific to a key
     */
    public async getKeySpecificAccount({
        key,
    }: { key: "interaction-executor" | "oracle-updater" | (string & {}) }) {
        const pkey = await this.getDerivedKey(key);
        return privateKeyToAccount(pkey);
    }
}
