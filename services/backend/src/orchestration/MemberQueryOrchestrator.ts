import {
    and,
    count,
    eq,
    gte,
    inArray,
    isNull,
    lte,
    min,
    type SQL,
    sql,
} from "drizzle-orm";
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
import { buildRewardsExpression, getTokenPrices } from "./campaigns/rewards";
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
    /**
     * Caller's preferred display currency (lowercase SDK `Currency`).
     * Drives the token→fiat conversion of `totalRewardsFiat`. Normalised
     * via `toFiatCurrency` (defaults EUR).
     */
    currency?: string;
};

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

        const tokenPrices = await getTokenPrices(
            this.pricingRepository,
            inArray(assetLogsTable.merchantId, merchantIds),
            params.currency
        );
        const fiatRewardsExpr = buildRewardsExpression(tokenPrices);

        const havingConditions = this.buildHavingConditions(params.filter);
        const sortExpr = this.buildSortExpression(params.sort, fiatRewardsExpr);

        const limit = params.limit ?? 20;
        const offset = params.offset ?? 0;

        const countQuery = db.select({ total: count() }).from(
            db
                .select({
                    groupId: identityNodesTable.groupId,
                    totalInteractions: count(interactionLogsTable.id).as(
                        "total_interactions"
                    ),
                    totalRewardsFiat:
                        sql<number>`COALESCE(SUM(${fiatRewardsExpr}), 0)`.as(
                            "total_rewards_fiat"
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
                        isNull(identityNodesTable.merchantId),
                        isNull(identityNodesTable.unlinkedAt)
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
                totalRewardsFiat:
                    sql<number>`ROUND(COALESCE(SUM(${fiatRewardsExpr}), 0)::NUMERIC, 2)`.as(
                        "total_rewards_fiat"
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
                    isNull(identityNodesTable.merchantId),
                    isNull(identityNodesTable.unlinkedAt)
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
                totalRewardsFiat: Number(row.totalRewardsFiat),
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

        const havingConditions = this.buildHavingConditions(filter);

        const [result] = await db.select({ total: count() }).from(
            db
                .select({
                    groupId: identityNodesTable.groupId,
                    totalInteractions: count(interactionLogsTable.id).as(
                        "total_interactions"
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
                        isNull(identityNodesTable.merchantId),
                        isNull(identityNodesTable.unlinkedAt)
                    )
                )
                .groupBy(identityNodesTable.groupId)
                .having(havingConditions)
                .as("counted_members")
        );

        return result?.total ?? 0;
    }

    // No asset_logs join / pricing here (unlike queryMembers): the supported
    // filters never touch rewards, so the audience needs only the
    // identity_nodes x interaction_logs aggregate.
    async resolveWallets(
        accessibleMerchantIds: string[],
        filter?: MemberQueryFilter
    ): Promise<Address[]> {
        if (accessibleMerchantIds.length === 0) return [];

        const merchantIds = this.scopeMerchantIds(
            accessibleMerchantIds,
            filter?.merchantIds
        );
        if (merchantIds.length === 0) return [];

        const rows = await db
            .select({
                wallet: sql<Address>`${identityNodesTable.identityValue}`.as(
                    "wallet_address"
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
            .where(
                and(
                    eq(identityNodesTable.identityType, "wallet"),
                    isNull(identityNodesTable.merchantId),
                    isNull(identityNodesTable.unlinkedAt)
                )
            )
            .groupBy(
                identityNodesTable.groupId,
                identityNodesTable.identityValue
            )
            .having(this.buildHavingConditions(filter));

        return rows.map((row) => getAddress(row.wallet));
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
            conditions.push(gte(min(interactionLogsTable.createdAt), minDate));
        }
        if (filter?.firstInteractionTimestamp?.max !== undefined) {
            const maxDate = new Date(
                filter.firstInteractionTimestamp.max * 1000
            );
            conditions.push(lte(min(interactionLogsTable.createdAt), maxDate));
        }

        if (conditions.length === 0) return undefined;
        return and(...conditions);
    }

    private buildSortExpression(
        sort: MemberQuerySort | undefined,
        fiatRewardsExpr: SQL
    ): SQL {
        const direction = sort?.order === "asc" ? sql`ASC` : sql`DESC`;

        switch (sort?.by) {
            case "totalInteractions":
                return sql`COUNT(${interactionLogsTable.id}) ${direction}`;
            case "totalRewardsFiat":
                return sql`COALESCE(SUM(${fiatRewardsExpr}), 0) ${direction}`;
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
