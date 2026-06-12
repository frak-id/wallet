import { stablecoins } from "@frak-labs/app-essentials/blockchain";
import { Mutex } from "async-mutex";
import ky, { type KyInstance } from "ky";
import { LRUCache } from "lru-cache";
import { type Address, isAddressEqual } from "viem";
import { log } from "../external/logger";
import { type FxRateRepository, fxRateRepository } from "./FxRateRepository";

export type TokenPrice = {
    eur: number;
    usd: number;
    gbp: number;
};

/** Fiat currencies a token spot price is quoted in — the {@link TokenPrice} keys. */
const TOKEN_PRICE_CURRENCIES = ["eur", "usd", "gbp"] as const;
type PegCurrency = (typeof TOKEN_PRICE_CURRENCIES)[number];

function isTokenPriceCurrency(currency: string): currency is PegCurrency {
    return (TOKEN_PRICE_CURRENCIES as readonly string[]).includes(currency);
}

/**
 * Tokens redeemable 1:1 for a fiat currency (Monerium e-money tokens + USDC).
 * Priced at exactly 1 unit of their peg — no market data needed; other fiat
 * legs go through ECB FX rates. Both environments are mapped so testnet
 * tokens price correctly too (several are not listed on CoinGecko at all).
 */
const PEGGED_TOKENS: ReadonlyArray<readonly [Address, PegCurrency]> = [
    [stablecoins.prod.eure, "eur"],
    [stablecoins.testnet.eure, "eur"],
    [stablecoins.prod.gbpe, "gbp"],
    [stablecoins.testnet.gbpe, "gbp"],
    [stablecoins.prod.usde, "usd"],
    [stablecoins.testnet.usde, "usd"],
    [stablecoins.prod.usdc, "usd"],
    [stablecoins.testnet.usdc, "usd"],
];

function pegCurrencyOf(token: Address): PegCurrency | undefined {
    return PEGGED_TOKENS.find(([address]) =>
        isAddressEqual(address, token)
    )?.[1];
}

/** `converted: false` ⇒ caller must not mint (no FX rate or no token price). */
export type FiatToTokenConversion =
    | { converted: true; tokenAmount: number }
    | {
          converted: false;
          reason: "fx_rate_unavailable" | "token_price_unavailable";
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

    constructor(private readonly fxRates: FxRateRepository) {
        // Build our ky client
        this.client = ky.create({
            prefix: "https://api.coingecko.com/api/v3/",
            headers: {
                "Content-Type": "application/json",
                accept: "application/json",
                "x-cg-demo-api-key": process.env.COIN_GECKO_API_KEY,
            },
        });
    }

    /**
     * Get a current token price in eur, usd and gbp. Pegged stablecoins are
     * priced from their 1:1 redemption plus FX rates; anything else comes
     * from CoinGecko spot data.
     * @param token
     */
    async getTokenPrice({
        token,
    }: {
        token: Address;
    }): Promise<TokenPrice | undefined> {
        const peg = pegCurrencyOf(token);
        if (peg) return this.getPeggedTokenPrice(peg);

        // Check cache outside mutex to avoid serializing cache hits
        const cached = this.cache.get(token);
        if (cached === "unknown") return undefined;
        if (cached) return cached;

        // Cache miss — acquire mutex for the API call
        return this.apiMutex.runExclusive(() => this._getTokenPrice({ token }));
    }

    /**
     * Convert a fiat amount (in the order's `currency`) into `token` units.
     * Percentage rewards are a share of the order total in fiat, so this must
     * run before the figure is treated as a token amount or a ¥100,000 order
     * pays out ~150× its intended value.
     *
     * Pegged tokens take at most one FX hop (order currency → peg); arbitrary
     * ERC20s divide by the CoinGecko spot price, hopping exotic order
     * currencies through USD first.
     */
    async convertFiatToTokenAmount({
        token,
        fiatAmount,
        currency,
    }: {
        token: Address;
        fiatAmount: number;
        currency: string;
    }): Promise<FiatToTokenConversion> {
        const orderCurrency = currency.toLowerCase();

        const peg = pegCurrencyOf(token);
        if (peg) {
            if (orderCurrency === peg) {
                return { converted: true, tokenAmount: fiatAmount };
            }
            const rate = await this.fxRates.getRate({
                from: orderCurrency,
                to: peg,
            });
            if (rate === undefined) {
                return { converted: false, reason: "fx_rate_unavailable" };
            }
            return { converted: true, tokenAmount: fiatAmount * rate };
        }

        const price = await this.getTokenPrice({ token });
        if (!price) {
            return { converted: false, reason: "token_price_unavailable" };
        }

        if (isTokenPriceCurrency(orderCurrency)) {
            const unitPrice = price[orderCurrency];
            if (unitPrice <= 0) {
                return { converted: false, reason: "token_price_unavailable" };
            }
            return { converted: true, tokenAmount: fiatAmount / unitPrice };
        }

        const usdRate = await this.fxRates.getRate({
            from: orderCurrency,
            to: "usd",
        });
        if (usdRate === undefined) {
            return { converted: false, reason: "fx_rate_unavailable" };
        }
        if (price.usd <= 0) {
            return { converted: false, reason: "token_price_unavailable" };
        }
        return {
            converted: true,
            tokenAmount: (fiatAmount * usdRate) / price.usd,
        };
    }

    private async getPeggedTokenPrice(
        peg: PegCurrency
    ): Promise<TokenPrice | undefined> {
        const price: TokenPrice = { eur: 1, usd: 1, gbp: 1 };
        const targets = TOKEN_PRICE_CURRENCIES.filter(
            (currency) => currency !== peg
        );
        const rates = await Promise.all(
            targets.map((currency) =>
                this.fxRates.getRate({ from: peg, to: currency })
            )
        );
        for (const [index, currency] of targets.entries()) {
            const rate = rates[index];
            if (rate === undefined) return undefined;
            price[currency] = rate;
        }
        return price;
    }

    private async _getTokenPrice({ token }: { token: Address }) {
        // Re-check cache inside mutex (another call may have populated it)
        const cached = this.cache.get(token);
        if (cached === "unknown") {
            return undefined;
        }
        if (cached) {
            return cached;
        }

        try {
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
                    contract_addresses: token,
                    vs_currencies: "usd,eur,gbp",
                },
            });

            // Extract the token price
            const prices = await response.json();
            const tokenPrice = Object.values(prices)[0];

            // Cache the result
            this.cache.set(token, tokenPrice ?? "unknown");
            return tokenPrice ?? undefined;
        } catch (error) {
            log.warn({ error }, "[PricingRepository] Unable to get toke price");
            return undefined;
        }
    }
}

export const pricingRepository = new PricingRepository(fxRateRepository);
