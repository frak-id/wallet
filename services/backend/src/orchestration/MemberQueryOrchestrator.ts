import { and, count, eq, inArray, min, type SQL, sql, sum } from "drizzle-orm";
import type { Static } from "elysia";
import type { Address } from "viem";
import { touchpointsTable } from "../domain/attribution/db/schema";
import { identityNodesTable } from "../domain/identity/db/schema";
import { merchantsTable } from "../domain/merchant/db/schema";
import type { MerchantAuthorizationService } from "../domain/merchant/services/MerchantAuthorizationService";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../domain/rewards/db/schema";
import { db } from "../infrastructure/persistence/postgres";
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

export class MemberQueryOrchestrator {
    constructor(readonly authorizationService: MerchantAuthorizationService) {}

    private scopeMerchantIds(
        accessible: string[],
        filter?: string[]
    ): string[] {
        if (!filter || filter.length === 0) return accessible;
        const accessibleSet = new Set(accessible);
        return filter.filter((id) => accessibleSet.has(id));
    }

    async queryMembers(
        wallet: Address,
        params: MemberQueryParams
    ): Promise<MemberQueryResult> {
        const accessible =
            await this.authorizationService.getAccessibleMerchantIds(wallet);
        if (accessible.length === 0) {
            return { totalResult: 0, members: [] };
        }

        const merchantIds = this.scopeMerchantIds(
            accessible,
            params.filter?.merchantIds
        );
        if (merchantIds.length === 0) {
            return { totalResult: 0, members: [] };
        }

        const havingConditions = this.buildHavingConditions(params.filter);
        const sortExpr = this.buildSortExpression(params.sort);

        const limit = params.limit ?? 20;
        const offset = params.offset ?? 0;

        const countQuery = db.select({ total: count() }).from(
            db
                .select({
                    groupId: identityNodesTable.groupId,
                    totalInteractions: count(interactionLogsTable.id).as(
                        "total_interactions"
                    ),
                    totalRewards:
                        sql<string>`COALESCE(${sum(assetLogsTable.amount)}, '0')`.as(
                            "total_rewards"
                        ),
                    firstInteraction: min(touchpointsTable.createdAt).as(
                        "first_interaction"
                    ),
                })
                .from(identityNodesTable)
                .innerJoin(
                    touchpointsTable,
                    and(
                        eq(
                            touchpointsTable.identityGroupId,
                            identityNodesTable.groupId
                        ),
                        inArray(touchpointsTable.merchantId, merchantIds)
                    )
                )
                .leftJoin(
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
                totalRewards:
                    sql<string>`COALESCE(${sum(assetLogsTable.amount)}, '0')`.as(
                        "total_rewards"
                    ),
                firstInteraction: min(touchpointsTable.createdAt).as(
                    "first_interaction"
                ),
                merchantIdsAgg: sql<
                    string[]
                >`ARRAY_AGG(DISTINCT ${touchpointsTable.merchantId})`.as(
                    "merchant_ids"
                ),
            })
            .from(identityNodesTable)
            .innerJoin(
                touchpointsTable,
                and(
                    eq(
                        touchpointsTable.identityGroupId,
                        identityNodesTable.groupId
                    ),
                    inArray(touchpointsTable.merchantId, merchantIds)
                )
            )
            .leftJoin(
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
                user: row.walletAddress,
                totalInteractions: Number(row.totalInteractions),
                rewards: row.totalRewards ?? "0",
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
        wallet: Address,
        filter?: MemberQueryFilter
    ): Promise<number> {
        const accessible =
            await this.authorizationService.getAccessibleMerchantIds(wallet);
        if (accessible.length === 0) return 0;

        const merchantIds = this.scopeMerchantIds(
            accessible,
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
                    totalRewards:
                        sql<string>`COALESCE(${sum(assetLogsTable.amount)}, '0')`.as(
                            "total_rewards"
                        ),
                    firstInteraction: min(touchpointsTable.createdAt).as(
                        "first_interaction"
                    ),
                })
                .from(identityNodesTable)
                .innerJoin(
                    touchpointsTable,
                    and(
                        eq(
                            touchpointsTable.identityGroupId,
                            identityNodesTable.groupId
                        ),
                        inArray(touchpointsTable.merchantId, merchantIds)
                    )
                )
                .leftJoin(
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

    private buildHavingConditions(filter?: MemberQueryFilter): SQL | undefined {
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

        if (filter?.rewards?.min !== undefined) {
            conditions.push(
                sql`COALESCE(SUM(${assetLogsTable.amount}), '0')::NUMERIC >= ${filter.rewards.min}::NUMERIC`
            );
        }
        if (filter?.rewards?.max !== undefined) {
            conditions.push(
                sql`COALESCE(SUM(${assetLogsTable.amount}), '0')::NUMERIC <= ${filter.rewards.max}::NUMERIC`
            );
        }

        if (filter?.firstInteractionTimestamp?.min !== undefined) {
            const minDate = new Date(
                filter.firstInteractionTimestamp.min * 1000
            );
            conditions.push(
                sql`MIN(${touchpointsTable.createdAt}) >= ${minDate}`
            );
        }
        if (filter?.firstInteractionTimestamp?.max !== undefined) {
            const maxDate = new Date(
                filter.firstInteractionTimestamp.max * 1000
            );
            conditions.push(
                sql`MIN(${touchpointsTable.createdAt}) <= ${maxDate}`
            );
        }

        if (conditions.length === 0) return undefined;
        return and(...conditions);
    }

    private buildSortExpression(sort?: MemberQuerySort): SQL {
        const direction = sort?.order === "asc" ? sql`ASC` : sql`DESC`;

        switch (sort?.by) {
            case "totalInteractions":
                return sql`COUNT(${interactionLogsTable.id}) ${direction}`;
            case "rewards":
                return sql`COALESCE(SUM(${assetLogsTable.amount}), '0')::NUMERIC ${direction}`;
            case "firstInteractionTimestamp":
                return sql`MIN(${touchpointsTable.createdAt}) ${direction}`;
            default:
                return sql`MIN(${touchpointsTable.createdAt}) ${direction}`;
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
