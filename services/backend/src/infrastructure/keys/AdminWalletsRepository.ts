import { createHmac } from "node:crypto";
import { Mutex } from "async-mutex";
import { LRUCache } from "lru-cache";
import { type Hex, hexToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

type AccountPredefinedKeys =
    | "minter"
    | "monerium-dev"
    | "rewarder"
    | "bank-manager"
    | (string & {});

export class AdminWalletsRepository {
    private cache: LRUCache<string, Hex> = new LRUCache({
        max: 1024,
    });
    private mutexLocks: LRUCache<string, Mutex> = new LRUCache({
        max: 64,
    });

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

    private async getMasterPrivateKey() {
        return this.getFromCacheOrFetch("master-pkey", async () => {
            if (!process.env.MASTER_KEY_SECRET) {
                throw new Error("Missing MASTER_KEY_SECRET");
            }

            const value = JSON.parse(process.env.MASTER_KEY_SECRET) as {
                masterPrivateKey: string;
            };
            if (!value.masterPrivateKey) {
                throw new Error("Missing masterPrivateKey in the secret");
            }
            return `0x${value.masterPrivateKey}` as Hex;
        });
    }

    private async getDerivedKey(key: string) {
        return this.getFromCacheOrFetch(`derived-key-${key}`, async () => {
            const masterPrivateKey = await this.getMasterPrivateKey();
            const hmac = createHmac("sha256", hexToBytes(masterPrivateKey));
            hmac.update(key);
            return `0x${hmac.digest("hex")}` as Hex;
        });
    }

    public async getKeySpecificAccount({
        key,
    }: {
        key: AccountPredefinedKeys;
    }) {
        const pkey = await this.getDerivedKey(key);
        return privateKeyToAccount(pkey);
    }

    /**
     * Raw key bytes for a non-wallet secret, from the same cached derivation
     * as `getKeySpecificAccount`. Labels share one namespace with
     * `AccountPredefinedKeys`, so keep them prefixed (`"totp-encryption"`).
     */
    public async deriveKeyBytes(label: string): Promise<Uint8Array> {
        const hex = await this.getDerivedKey(label);
        return hexToBytes(hex);
    }

    /**
     * Per-key mutex, so callers serialising nonce usage on one admin account
     * all take the same lock.
     */
    public getMutexForAccount({ key }: { key: AccountPredefinedKeys }) {
        const lock = this.mutexLocks.get(key);
        if (lock) {
            return lock;
        }
        const newLock = new Mutex();
        this.mutexLocks.set(key, newLock);
        return newLock;
    }
}

export const adminWalletsRepository = new AdminWalletsRepository();
