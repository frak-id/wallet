import { eq, inArray, type SQL, sql } from "drizzle-orm";
import type { Address } from "viem";
import { assetLogsTable } from "../../domain/rewards/db/schema";
import { db } from "../../infrastructure/persistence/postgres";
import type { PricingRepository } from "../../infrastructure/pricing/PricingRepository";

/**
 * Token address → USD spot price. Keys come straight from
 * `asset_logs.token_address` (drizzle's `customHex` returns `0x`-prefixed
 * lowercase hex). The case is irrelevant to the SQL comparison because
 * the underlying column is `bytea` — both `getAddress(addr)` and the
 * raw form parse to identical buffers via `hexToBytes`.
 */
export type TokenPriceMap = Map<string, number>;

/**
 * Build a CASE expression that converts on-chain reward amounts to USD.
 * Each WHEN clause matches one token address from `prices` and
 * multiplies the row's `amount` by the corresponding USD price. Falls
 * back to `0` when no prices are known so unpriced tokens contribute
 * nothing to aggregates.
 */
export function buildUsdRewardsExpression(prices: TokenPriceMap): SQL {
    if (prices.size === 0) return sql`0`;
    const whenClauses: SQL[] = [];
    for (const [token, usdPrice] of prices) {
        // `eq()` carries the column's `customHex` encoder so the `token`
        // param is bound as bytea. A bare `${token}` in the template
        // would bind as text and Postgres would reject `0x…` (its bytea
        // hex input is `\x…`).
        whenClauses.push(
            sql`WHEN ${eq(assetLogsTable.tokenAddress, token as Address)} THEN ${assetLogsTable.amount}::NUMERIC * ${usdPrice}`
        );
    }
    return sql`CASE ${sql.join(whenClauses, sql` `)} ELSE 0 END`;
}

/**
 * Distinct token addresses across one or more merchants' asset logs,
 * each mapped to its current USD spot price via the pricing repo.
 * Tokens that fail price lookup are simply absent from the map — they
 * fall to the `ELSE 0` branch of `buildUsdRewardsExpression`.
 */
export async function getTokenPricesForMerchants(
    pricingRepository: PricingRepository,
    merchantIds: string[]
): Promise<TokenPriceMap> {
    if (merchantIds.length === 0) return new Map();

    const tokenRows = await db
        .selectDistinct({ tokenAddress: assetLogsTable.tokenAddress })
        .from(assetLogsTable)
        .where(inArray(assetLogsTable.merchantId, merchantIds));

    const tokens = tokenRows
        .map((r) => r.tokenAddress)
        .filter((addr): addr is Address => addr !== null);

    const prices: TokenPriceMap = new Map();
    await Promise.all(
        tokens.map(async (token) => {
            const price = await pricingRepository.getTokenPrice({ token });
            if (price) prices.set(token, price.usd);
        })
    );
    return prices;
}
