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
 * Resolve a `TokenPrice` to a single fiat scalar. Defaults to EUR
 * when the currency is unrecognised — matches the launch market and
 * keeps downstream CASE expressions populated rather than silently
 * zeroing.
 */
function pickFiatPrice(
    price: { eur: number; usd: number; gbp: number },
    currency: FiatCurrency
): number {
    switch (currency) {
        case "USD":
            return price.usd;
        case "GBP":
            return price.gbp;
        default:
            return price.eur;
    }
}

/**
 * Build a `TokenPriceMap` for the requested fiat currency over the
 * subset of `asset_logs` rows matched by `scope`.
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
    currency: FiatCurrency
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
