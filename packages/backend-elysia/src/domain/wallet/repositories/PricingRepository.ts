import { addresses } from "@frak-labs/app-essentials";
import { Mutex } from "async-mutex";
import ky, { type KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import { Config } from "sst/node/config";
import { type Address, isAddressEqual } from "viem";

type TokenPrice = {
    eur: number;
    usd: number;
};

export class PricingRepository {
    // Cache for the prices
    private readonly cache = new LRUCache<Address, TokenPrice>({
        // Max 128 items in the cache
        max: 128,
        // Max age of 20 minute
        ttl: 1000 * 60 * 20,
    });

    // Mutex for the api calls
    private readonly apiMutex = new Mutex();

    // The ky client
    private readonly client: KyInstance;

    constructor() {
        // Build our ky client
        this.client = ky.create({
            prefixUrl: "https://api.coingecko.com/api/v3/",
            headers: {
                "Content-Type": "application/json",
                accept: "application/json",
                "x-cg-demo-api-key": Config.COIN_GECKO_API_KEY,
            },
        });
    }

    /**
     * Get a current token price in both eur and usd
     * @param token
     */
    async getTokenPrice({ token }: { token: Address }) {
        return this.apiMutex.runExclusive(() => this._getTokenPrice({ token }));
    }

    /**
     * Get a current token price in both eur and usd
     */
    private async _getTokenPrice({ token }: { token: Address }) {
        // Replaced mocked USD token address with the usdc address
        const finalToken = isAddressEqual(token, addresses.mUSDToken)
            ? "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
            : token;

        // Check if we have the token in cache
        const cached = this.cache.get(finalToken);
        if (cached) {
            return cached;
        }

        // Perform the query
        const response = await this.client.get<{
            [key: string]: {
                usd: number;
                eur: number;
            };
        }>("simple/token_price/arbitrum-one", {
            searchParams: {
                contract_addresses: finalToken,
                vs_currencies: "usd,eur",
            },
        });

        // Extract the token price
        const prices = await response.json();
        const tokenPrice = Object.values(prices)[0];

        // Cache the result
        this.cache.set(finalToken, tokenPrice);
        return tokenPrice;
    }
}
