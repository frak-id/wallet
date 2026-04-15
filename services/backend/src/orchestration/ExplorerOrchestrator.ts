import { and, count, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { campaignRulesTable } from "../domain/campaign/db/schema";
import {
    merchantExplorerRankingTable,
    merchantsTable,
} from "../domain/merchant/db/schema";
import { db } from "../infrastructure/persistence/postgres";
import type {
    ExplorerMerchantItem,
    ExplorerQueryResult,
} from "./schemas/explorerSchemas";

type ExplorerQueryParams = {
    limit?: number;
    offset?: number;
};

export class ExplorerOrchestrator {
    private readonly cache = new LRUCache<
        string,
        { value: ExplorerQueryResult }
    >({
        max: 128,
        ttl: 30_000,
    });

    async queryMerchants(
        params: ExplorerQueryParams
    ): Promise<ExplorerQueryResult> {
        const limit = params.limit ?? 20;
        const offset = params.offset ?? 0;
        const cacheKey = `${limit}:${offset}`;

        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached.value;
        }

        const result = await this.fetchMerchants(limit, offset);
        this.cache.set(cacheKey, { value: result });
        return result;
    }

    invalidateCache(): void {
        this.cache.clear();
    }

    private async fetchMerchants(
        limit: number,
        offset: number
    ): Promise<ExplorerQueryResult> {
        const now = new Date();

        const activeCampaignFilter = and(
            eq(campaignRulesTable.status, "active"),
            or(
                isNull(campaignRulesTable.expiresAt),
                gt(campaignRulesTable.expiresAt, now)
            )
        );

        const rows = await db
            .select({
                id: merchantsTable.id,
                name: merchantsTable.name,
                domain: merchantsTable.domain,
                explorerConfig: merchantsTable.explorerConfig,
                activeCampaignCount: count(campaignRulesTable.id).as(
                    "active_campaign_count"
                ),
                totalResult: sql<number>`COUNT(*) OVER()`
                    .mapWith(Number)
                    .as("total_result"),
            })
            .from(merchantsTable)
            .innerJoin(
                campaignRulesTable,
                and(
                    eq(campaignRulesTable.merchantId, merchantsTable.id),
                    activeCampaignFilter
                )
            )
            .leftJoin(
                merchantExplorerRankingTable,
                eq(merchantExplorerRankingTable.merchantId, merchantsTable.id)
            )
            .where(isNotNull(merchantsTable.explorerEnabledAt))
            .groupBy(
                merchantsTable.id,
                merchantExplorerRankingTable.manualBoost
            )
            .orderBy(
                sql`COALESCE(${merchantExplorerRankingTable.manualBoost}, 0) DESC`,
                sql`COUNT(${campaignRulesTable.id}) DESC`
            )
            .limit(limit)
            .offset(offset);

        if (rows.length === 0) {
            return { totalResult: 0, merchants: [] };
        }

        const totalResult = rows[0]?.totalResult ?? 0;

        const merchants: ExplorerMerchantItem[] = rows.map((row) => ({
            id: row.id,
            name: row.name,
            domain: row.domain,
            explorerConfig: row.explorerConfig ?? null,
            activeCampaignCount: Number(row.activeCampaignCount),
        }));

        return { totalResult, merchants };
    }
}
