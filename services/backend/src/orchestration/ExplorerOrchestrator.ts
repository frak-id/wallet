import { and, count, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";
import { campaignRulesTable } from "../domain/campaign/db/schema";
import { merchantsTable } from "../domain/merchant/db/schema";
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
    async queryMerchants(
        params: ExplorerQueryParams
    ): Promise<ExplorerQueryResult> {
        const limit = params.limit ?? 20;
        const offset = params.offset ?? 0;
        const now = new Date();

        const activeCampaignFilter = and(
            eq(campaignRulesTable.status, "active"),
            or(
                isNull(campaignRulesTable.expiresAt),
                gt(campaignRulesTable.expiresAt, now)
            )
        );

        const explorerFilter = isNotNull(merchantsTable.explorerEnabledAt);

        const baseQuery = db
            .select({
                merchantId: merchantsTable.id,
                activeCampaignCount: count(campaignRulesTable.id).as(
                    "active_campaign_count"
                ),
            })
            .from(merchantsTable)
            .innerJoin(
                campaignRulesTable,
                and(
                    eq(campaignRulesTable.merchantId, merchantsTable.id),
                    activeCampaignFilter
                )
            )
            .where(explorerFilter)
            .groupBy(merchantsTable.id);

        const [countResult] = await db
            .select({ total: count() })
            .from(baseQuery.as("merchants_with_campaigns"));

        const totalResult = countResult?.total ?? 0;

        if (totalResult === 0) {
            return { totalResult: 0, merchants: [] };
        }

        const rows = await db
            .select({
                id: merchantsTable.id,
                name: merchantsTable.name,
                domain: merchantsTable.domain,
                explorerConfig: merchantsTable.explorerConfig,
                activeCampaignCount: count(campaignRulesTable.id).as(
                    "active_campaign_count"
                ),
            })
            .from(merchantsTable)
            .innerJoin(
                campaignRulesTable,
                and(
                    eq(campaignRulesTable.merchantId, merchantsTable.id),
                    activeCampaignFilter
                )
            )
            .where(explorerFilter)
            .groupBy(merchantsTable.id)
            .orderBy(sql`COUNT(${campaignRulesTable.id}) DESC`)
            .limit(limit)
            .offset(offset);

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
