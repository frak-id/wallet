import { addresses } from "@frak-labs/app-essentials";
import {
    currentStablecoins,
    usdcArbitrumAddress,
} from "@frak-labs/app-essentials/blockchain";
import type { Currency } from "@frak-labs/core-sdk";
import { Mutex } from "async-mutex";
import ky, { type KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import { type Address, isAddressEqual } from "viem";

export type TokenPrice = {
    eur: number;
    usd: number;
    gbp: number;
};

export class PricingRepository {
    // Cache for the prices
    private readonly cache = new LRUCache<Address, TokenPrice | "unknown">({
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
                "x-cg-demo-api-key": process.env.COIN_GECKO_API_KEY,
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
     * Get exchange rate between two currencies
     * @param fromCurrency
     * @param toCurrency
     */
    async getExchangeRate({
        fromCurrency,
        toCurrency,
    }: {
        fromCurrency: Currency;
        toCurrency: Currency;
    }): Promise<number> {
        // If same currency, return 1
        if (fromCurrency === toCurrency) {
            return 1;
        }

        // For different currencies, we would need to implement proper exchange rate logic
        // For now, return 1 as a placeholder (this should be implemented with real exchange rates)
        return 1;
    }

    /**
     * Get a current token price in both eur and usd
     */
    private async _getTokenPrice({ token }: { token: Address }) {
        // Handle special token mappings
        let finalToken = token;

        // Replace mocked USD token address with the usdc address
        if (isAddressEqual(token, addresses.mUSDToken)) {
            finalToken = usdcArbitrumAddress;
        }

        // For stablecoins, return fixed rates
        if (isAddressEqual(token, currentStablecoins.usde)) {
            return { usd: 1, eur: 0.85, gbp: 0.75 }; // Approximate rates
        }
        if (isAddressEqual(token, currentStablecoins.eure)) {
            return { usd: 1.18, eur: 1, gbp: 0.88 }; // Approximate rates
        }
        if (isAddressEqual(token, currentStablecoins.gbpe)) {
            return { usd: 1.33, eur: 1.14, gbp: 1 }; // Approximate rates
        }

        // Check if we have the token in cache
        const cached = this.cache.get(finalToken);
        if (cached === "unknown") {
            return undefined;
        }
        if (cached) {
            return cached;
        }

        // Perform the query
        const response = await this.client.get<{
            [key: string]:
                | {
                      usd: number;
                      eur: number;
                      gbp: number;
                  }
                | undefined;
        }>("simple/token_price/arbitrum-one", {
            searchParams: {
                contract_addresses: finalToken,
                vs_currencies: "usd,eur,gbp",
            },
        });

        // Extract the token price
        const prices = await response.json();
        const tokenPrice = Object.values(prices)[0];

        // Cache the result
        this.cache.set(finalToken, tokenPrice ?? "unknown");
        return tokenPrice ?? undefined;
    }
}

export const pricingRepository = new PricingRepository();
