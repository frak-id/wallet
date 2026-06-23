import { eq, type SQL, sql } from "drizzle-orm";
import type { Address } from "viem";
import { assetLogsTable } from "../../domain/rewards/db/schema";
import { db } from "../../infrastructure/persistence/postgres";
import type { PricingRepository } from "../../infrastructure/pricing/PricingRepository";

/**
 * Token address → fiat spot price. Keys come straight from
 * `asset_logs.token_address` (drizzle's `customHex` returns
 * `0x`-prefixed lowercase hex). Case is irrelevant to the SQL
 * comparison because the underlying column is `bytea` — both
 * `getAddress(addr)` and the raw form parse to identical buffers
 * via `hexToBytes`.
 */
export type TokenPriceMap = Map<string, number>;

/**
 * Supported fiat currency codes for token → fiat conversion. Mirrors
 * the `{ eur, usd, gbp }` shape returned by
 * `PricingRepository.getTokenPrice`.
 */
export type FiatCurrency = "EUR" | "USD" | "GBP";

/**
 * Normalise a wire currency code to a {@link FiatCurrency}. The frontend
 * sends the lowercase `Currency` union (`"eur" | "usd" | "gbp"`); the
 * pricing layer keys on uppercase ISO-4217. Falls back to EUR for
 * undefined, empty or unsupported codes — same default as
 * {@link pickFiatPrice}, our launch market.
 */
export function toFiatCurrency(currency?: string): FiatCurrency {
    switch (currency?.toUpperCase()) {
        case "USD":
            return "USD";
        case "GBP":
            return "GBP";
        default:
            return "EUR";
    }
}

/**
 * Build a CASE expression that converts on-chain reward amounts to
 * the fiat unit baked into `prices`. Each WHEN clause matches one
 * token address and multiplies the row's `amount` by the
 * corresponding spot price. Falls back to `0` when no prices are
 * known so unpriced tokens contribute nothing to aggregates.
 */
export function buildRewardsExpression(prices: TokenPriceMap): SQL {
    if (prices.size === 0) return sql`0`;
    const whenClauses: SQL[] = [];
    for (const [token, price] of prices) {
        // `eq()` carries the column's `customHex` encoder so the
        // `token` param is bound as bytea. A bare `${token}` in the
        // template would bind as text and Postgres would reject
        // `0x…` (its bytea hex input is `\x…`).
        whenClauses.push(
            sql`WHEN ${eq(assetLogsTable.tokenAddress, token as Address)} THEN ${assetLogsTable.amount}::NUMERIC * ${price}`
        );
    }
    return sql`CASE ${sql.join(whenClauses, sql` `)} ELSE 0 END`;
}

/**
 * Resolve a `TokenPrice` to a single fiat scalar for the requested wire
 * currency. {@link toFiatCurrency} owns the code mapping + EUR fallback
 * (unrecognised/missing → EUR), so this only indexes the
 * `{ eur, usd, gbp }` struct — no second switch to keep in sync.
 */
function pickFiatPrice(
    price: { eur: number; usd: number; gbp: number },
    currency?: string
): number {
    const key = toFiatCurrency(currency).toLowerCase() as keyof typeof price;
    return price[key];
}

/**
 * Build a `TokenPriceMap` for the requested currency over the subset of
 * `asset_logs` rows matched by `scope`.
 *
 * `currency` is the raw wire value (lowercase SDK `Currency`, an uppercase
 * ISO code, or `undefined`); normalisation to {@link FiatCurrency} happens
 * once inside {@link pickFiatPrice}, so callers pass it straight through.
 *
 * `scope` is the WHERE clause that picks which rows we discover
 * token addresses from (typically merchant-scoped for overview, or
 * campaign-scoped for per-campaign reporting). Tokens that fail
 * price lookup are absent from the map — they fall through to the
 * `ELSE 0` branch of {@link buildRewardsExpression}.
 */
export async function getTokenPrices(
    pricingRepository: PricingRepository,
    scope: SQL,
    currency?: string
): Promise<TokenPriceMap> {
    const tokenRows = await db
        .selectDistinct({ tokenAddress: assetLogsTable.tokenAddress })
        .from(assetLogsTable)
        .where(scope);

    const tokens = tokenRows
        .map((r) => r.tokenAddress)
        .filter((addr): addr is Address => addr !== null);

    const prices: TokenPriceMap = new Map();
    await Promise.all(
        tokens.map(async (token) => {
            const price = await pricingRepository.getTokenPrice({ token });
            if (price) prices.set(token, pickFiatPrice(price, currency));
        })
    );
    return prices;
}
