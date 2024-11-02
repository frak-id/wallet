import { createHmac } from "node:crypto";
import {
    GetSecretValueCommand,
    SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { Mutex } from "async-mutex";
import { LRUCache } from "lru-cache";
import { type Hex, hexToBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

type AccountPredefinedKeys =
    | "interaction-executor"
    | "oracle-updater"
    | "minter"
    | (string & {});

/**
 * Build the repositories that we will use to interface with our different wallets
 */
export class AdminWalletsRepository {
    private secretManager: SecretsManagerClient = new SecretsManagerClient({
        region: "eu-west-1",
    });
    private cache: LRUCache<string, Hex> = new LRUCache({
        max: 1024,
    });
    private mutexLocks: LRUCache<string, Mutex> = new LRUCache({
        max: 64,
    });

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
            return cachedValue;
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
                    SecretId: process.env.MASTER_KEY_SECRET_ID,
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
    }: {
        key: AccountPredefinedKeys;
    }) {
        const pkey = await this.getDerivedKey(key);
        return privateKeyToAccount(pkey);
    }

    /**
     * Get an account specific to a key
     */
    public getMutexForAccount({
        key,
    }: {
        key: AccountPredefinedKeys;
    }) {
        const lock = this.mutexLocks.get(key);
        if (lock) {
            return lock;
        }
        const newLock = new Mutex();
        this.mutexLocks.set(key, newLock);
        return newLock;
    }
}
