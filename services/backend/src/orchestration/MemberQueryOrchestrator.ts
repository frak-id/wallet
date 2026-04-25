import { and, count, eq, inArray, min, type SQL, sql } from "drizzle-orm";
import type { Static } from "elysia";
import { type Address, getAddress } from "viem";
import { identityNodesTable } from "../domain/identity/db/schema";
import { merchantsTable } from "../domain/merchant/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../domain/rewards/db/schema";
import { db } from "../infrastructure/persistence/postgres";
import type { PricingRepository } from "../infrastructure/pricing/PricingRepository";
import type {
    MemberFilterSchema,
    MemberItemSchema,
    MemberQueryResultSchema,
    MemberSortSchema,
} from "./schemas/memberSchemas";

export type MemberQueryFilter = Static<typeof MemberFilterSchema>;
export type MemberQuerySort = Static<typeof MemberSortSchema>;
export type MemberItem = Static<typeof MemberItemSchema>;
export type MemberQueryResult = Static<typeof MemberQueryResultSchema>;

export type MemberQueryParams = {
    limit?: number;
    offset?: number;
    sort?: MemberQuerySort;
    filter?: MemberQueryFilter;
};

type TokenPriceMap = Map<string, number>;

export class MemberQueryOrchestrator {
    constructor(private readonly pricingRepository: PricingRepository) {}

    private scopeMerchantIds(
        accessible: string[],
        filter?: string[]
    ): string[] {
        if (!filter || filter.length === 0) return accessible;
        const accessibleSet = new Set(accessible);
        return filter.filter((id) => accessibleSet.has(id));
    }

    async queryMembers(
        accessibleMerchantIds: string[],
        params: MemberQueryParams
    ): Promise<MemberQueryResult> {
        if (accessibleMerchantIds.length === 0) {
            return { totalResult: 0, members: [] };
        }

        const merchantIds = this.scopeMerchantIds(
            accessibleMerchantIds,
            params.filter?.merchantIds
        );
        if (merchantIds.length === 0) {
            return { totalResult: 0, members: [] };
        }

        const tokenPrices = await this.getTokenPricesForMerchants(merchantIds);
        const usdRewardsExpr = this.buildUsdRewardsExpression(tokenPrices);

        const havingConditions = this.buildHavingConditions(params.filter);
        const sortExpr = this.buildSortExpression(params.sort, usdRewardsExpr);

        const limit = params.limit ?? 20;
        const offset = params.offset ?? 0;

        const countQuery = db.select({ total: count() }).from(
            db
                .select({
                    groupId: identityNodesTable.groupId,
                    totalInteractions: count(interactionLogsTable.id).as(
                        "total_interactions"
                    ),
                    totalRewardsUsd:
                        sql<number>`COALESCE(SUM(${usdRewardsExpr}), 0)`.as(
                            "total_rewards_usd"
                        ),
                    firstInteraction: min(interactionLogsTable.createdAt).as(
                        "first_interaction"
                    ),
                })
                .from(identityNodesTable)
                .innerJoin(
                    interactionLogsTable,
                    and(
                        eq(
                            interactionLogsTable.identityGroupId,
                            identityNodesTable.groupId
                        ),
                        inArray(interactionLogsTable.merchantId, merchantIds)
                    )
                )
                .leftJoin(
                    assetLogsTable,
                    and(
                        eq(
                            assetLogsTable.identityGroupId,
                            identityNodesTable.groupId
                        ),
                        inArray(assetLogsTable.merchantId, merchantIds)
                    )
                )
                .where(
                    and(
                        eq(identityNodesTable.identityType, "wallet"),
                        sql`${identityNodesTable.merchantId} IS NULL`
                    )
                )
                .groupBy(identityNodesTable.groupId)
                .having(havingConditions)
                .as("counted_members")
        );

        const [countResult] = await countQuery;
        const totalResult = countResult?.total ?? 0;

        if (totalResult === 0) {
            return { totalResult: 0, members: [] };
        }

        const rows = await db
            .select({
                walletAddress:
                    sql<Address>`${identityNodesTable.identityValue}`.as(
                        "wallet_address"
                    ),
                groupId: identityNodesTable.groupId,
                totalInteractions: count(interactionLogsTable.id).as(
                    "total_interactions"
                ),
                totalRewardsUsd:
                    sql<number>`ROUND(COALESCE(SUM(${usdRewardsExpr}), 0)::NUMERIC, 2)`.as(
                        "total_rewards_usd"
                    ),
                firstInteraction: min(interactionLogsTable.createdAt).as(
                    "first_interaction"
                ),
                merchantIdsAgg: sql<
                    string[]
                >`ARRAY_AGG(DISTINCT ${interactionLogsTable.merchantId})`.as(
                    "merchant_ids"
                ),
            })
            .from(identityNodesTable)
            .innerJoin(
                interactionLogsTable,
                and(
                    eq(
                        interactionLogsTable.identityGroupId,
                        identityNodesTable.groupId
                    ),
                    inArray(interactionLogsTable.merchantId, merchantIds)
                )
            )
            .leftJoin(
                assetLogsTable,
                and(
                    eq(
                        assetLogsTable.identityGroupId,
                        identityNodesTable.groupId
                    ),
                    inArray(assetLogsTable.merchantId, merchantIds)
                )
            )
            .where(
                and(
                    eq(identityNodesTable.identityType, "wallet"),
                    sql`${identityNodesTable.merchantId} IS NULL`
                )
            )
            .groupBy(
                identityNodesTable.groupId,
                identityNodesTable.identityValue
            )
            .having(havingConditions)
            .orderBy(sortExpr)
            .limit(limit)
            .offset(offset);

        const allMerchantIds = new Set<string>();
        for (const row of rows) {
            if (row.merchantIdsAgg) {
                for (const id of row.merchantIdsAgg) {
                    if (id) allMerchantIds.add(id);
                }
            }
        }

        const merchantNameMap = await this.getMerchantNameMap([
            ...allMerchantIds,
        ]);

        const members: MemberItem[] = rows.map((row) => {
            const mIds = (row.merchantIdsAgg ?? []).filter(Boolean);
            return {
                user: getAddress(row.walletAddress),
                totalInteractions: Number(row.totalInteractions),
                totalRewardsUsd: Number(row.totalRewardsUsd),
                firstInteractionTimestamp: row.firstInteraction
                    ? row.firstInteraction.toISOString()
                    : "",
                merchantIds: mIds,
                merchantNames: mIds.map(
                    (id) => merchantNameMap.get(id) ?? "Unknown"
                ),
            };
        });

        return { totalResult, members };
    }

    async countMembers(
        accessibleMerchantIds: string[],
        filter?: MemberQueryFilter
    ): Promise<number> {
        if (accessibleMerchantIds.length === 0) return 0;

        const merchantIds = this.scopeMerchantIds(
            accessibleMerchantIds,
            filter?.merchantIds
        );
        if (merchantIds.length === 0) return 0;

        const tokenPrices = await this.getTokenPricesForMerchants(merchantIds);
        const usdRewardsExpr = this.buildUsdRewardsExpression(tokenPrices);

        const havingConditions = this.buildHavingConditions(filter);

        const [result] = await db.select({ total: count() }).from(
            db
                .select({
                    groupId: identityNodesTable.groupId,
                    totalInteractions: count(interactionLogsTable.id).as(
                        "total_interactions"
                    ),
                    totalRewardsUsd:
                        sql<number>`COALESCE(SUM(${usdRewardsExpr}), 0)`.as(
                            "total_rewards_usd"
                        ),
                    firstInteraction: min(interactionLogsTable.createdAt).as(
                        "first_interaction"
                    ),
                })
                .from(identityNodesTable)
                .innerJoin(
                    interactionLogsTable,
                    and(
                        eq(
                            interactionLogsTable.identityGroupId,
                            identityNodesTable.groupId
                        ),
                        inArray(interactionLogsTable.merchantId, merchantIds)
                    )
                )
                .leftJoin(
                    assetLogsTable,
                    and(
                        eq(
                            assetLogsTable.identityGroupId,
                            identityNodesTable.groupId
                        ),
                        inArray(assetLogsTable.merchantId, merchantIds)
                    )
                )
                .where(
                    and(
                        eq(identityNodesTable.identityType, "wallet"),
                        sql`${identityNodesTable.merchantId} IS NULL`
                    )
                )
                .groupBy(identityNodesTable.groupId)
                .having(havingConditions)
                .as("counted_members")
        );

        return result?.total ?? 0;
    }

    // Produces: CASE WHEN token_address = '0x..' THEN amount * usd_price ... ELSE 0 END
    private buildUsdRewardsExpression(tokenPrices: TokenPriceMap): SQL {
        if (tokenPrices.size === 0) {
            return sql`0`;
        }

        const whenClauses: SQL[] = [];
        for (const [token, usdPrice] of tokenPrices) {
            whenClauses.push(
                sql`WHEN ${assetLogsTable.tokenAddress} = ${token} THEN ${assetLogsTable.amount}::NUMERIC * ${usdPrice}`
            );
        }

        return sql`CASE ${sql.join(whenClauses, sql` `)} ELSE 0 END`;
    }

    private async getTokenPricesForMerchants(
        merchantIds: string[]
    ): Promise<TokenPriceMap> {
        const tokenRows = await db
            .selectDistinct({
                tokenAddress: assetLogsTable.tokenAddress,
            })
            .from(assetLogsTable)
            .where(inArray(assetLogsTable.merchantId, merchantIds));

        const tokens = tokenRows
            .map((r) => r.tokenAddress)
            .filter((addr): addr is Address => addr !== null);

        const priceMap: TokenPriceMap = new Map();
        await Promise.all(
            tokens.map(async (token) => {
                const price = await this.pricingRepository.getTokenPrice({
                    token,
                });
                if (price) {
                    priceMap.set(token, price.usd);
                }
            })
        );

        return priceMap;
    }

    private buildHavingConditions(
        filter: MemberQueryFilter | undefined
    ): SQL | undefined {
        const conditions: SQL[] = [];

        if (filter?.interactions?.min !== undefined) {
            conditions.push(
                sql`COUNT(${interactionLogsTable.id}) >= ${filter.interactions.min}`
            );
        }
        if (filter?.interactions?.max !== undefined) {
            conditions.push(
                sql`COUNT(${interactionLogsTable.id}) <= ${filter.interactions.max}`
            );
        }

        if (filter?.firstInteractionTimestamp?.min !== undefined) {
            const minDate = new Date(
                filter.firstInteractionTimestamp.min * 1000
            );
            conditions.push(
                sql`MIN(${interactionLogsTable.createdAt}) >= ${minDate}`
            );
        }
        if (filter?.firstInteractionTimestamp?.max !== undefined) {
            const maxDate = new Date(
                filter.firstInteractionTimestamp.max * 1000
            );
            conditions.push(
                sql`MIN(${interactionLogsTable.createdAt}) <= ${maxDate}`
            );
        }

        if (conditions.length === 0) return undefined;
        return and(...conditions);
    }

    private buildSortExpression(
        sort: MemberQuerySort | undefined,
        usdRewardsExpr: SQL
    ): SQL {
        const direction = sort?.order === "asc" ? sql`ASC` : sql`DESC`;

        switch (sort?.by) {
            case "totalInteractions":
                return sql`COUNT(${interactionLogsTable.id}) ${direction}`;
            case "totalRewardsUsd":
                return sql`COALESCE(SUM(${usdRewardsExpr}), 0) ${direction}`;
            case "firstInteractionTimestamp":
                return sql`MIN(${interactionLogsTable.createdAt}) ${direction}`;
            default:
                return sql`MIN(${interactionLogsTable.createdAt}) ${direction}`;
        }
    }

    private async getMerchantNameMap(
        merchantIds: string[]
    ): Promise<Map<string, string>> {
        if (merchantIds.length === 0) return new Map();

        const merchants = await db
            .select({ id: merchantsTable.id, name: merchantsTable.name })
            .from(merchantsTable)
            .where(inArray(merchantsTable.id, merchantIds));

        return new Map(merchants.map((m) => [m.id, m.name]));
    }
}
