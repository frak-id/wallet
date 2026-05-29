import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import { identityNodesTable } from "../../domain/identity/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../../domain/rewards/db/schema";
import { db } from "../../infrastructure/persistence/postgres";

/**
 * Shared SQL fragments + subquery builders for the campaign reporting
 * orchestrators. The "attributed purchases" CTE pattern shows up six
 * times in the legacy code — extracting it here is the single biggest
 * dedup win.
 */

/**
 * Base predicate set for an "attributed purchase" — an un-cancelled
 * `asset_logs` row joined to its un-cancelled `purchase`
 * `interaction_logs` row. Every distinct-purchase subquery below
 * starts from this base and tacks on a scope filter (merchantId,
 * campaignRuleId, …) plus optionally a window filter.
 */
export function attributedPurchaseBasePredicates(): SQL[] {
    return [
        isNull(assetLogsTable.cancelledAt),
        eq(interactionLogsTable.type, "purchase"),
        isNull(interactionLogsTable.cancelledAt),
    ];
}

/**
 * Distinct-purchase subquery keyed by `(interactionLogId, amount)`.
 * Use when the caller cares about purchase-grain dedup only — merchant-
 * scoped KPIs (overview revenue/series, campaign-scoped GMV) where a
 * single basket must contribute its amount exactly once regardless of
 * how many recipients were rewarded.
 *
 * `extraWhere` is folded into the WHERE clause alongside the base
 * predicates so the caller can scope by merchant/campaign/window
 * without rebuilding the subquery from scratch.
 */
export function distinctPurchases(extraWhere: SQL[]) {
    return db
        .selectDistinct({
            interactionLogId: assetLogsTable.interactionLogId,
            createdAt: interactionLogsTable.createdAt,
            amount: sql<string>`(${interactionLogsTable.payload}->>'amount')::NUMERIC`.as(
                "amount"
            ),
            currency: sql<
                string | null
            >`${interactionLogsTable.payload}->>'currency'`.as("currency"),
        })
        .from(assetLogsTable)
        .innerJoin(
            interactionLogsTable,
            eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
        )
        .where(and(...attributedPurchaseBasePredicates(), ...extraWhere))
        .as("distinct_purchases");
}

/**
 * Distinct-purchase subquery keyed by `(campaignRuleId,
 * interactionLogId, amount)`. Use when the caller needs the
 * `campaignRuleId` column on each row — per-campaign roll-ups where
 * the same purchase rightfully contributes once *per campaign* it
 * triggered rewards on.
 *
 * Identical join semantics to {@link distinctPurchases}; the
 * additional column changes which rows the DB considers "distinct".
 */
export function distinctCampaignPurchases(extraWhere: SQL[]) {
    return db
        .selectDistinct({
            campaignRuleId: assetLogsTable.campaignRuleId,
            interactionLogId: assetLogsTable.interactionLogId,
            createdAt: interactionLogsTable.createdAt,
            amount: sql<string>`(${interactionLogsTable.payload}->>'amount')::NUMERIC`.as(
                "amount"
            ),
        })
        .from(assetLogsTable)
        .innerJoin(
            interactionLogsTable,
            eq(assetLogsTable.interactionLogId, interactionLogsTable.id)
        )
        .where(and(...attributedPurchaseBasePredicates(), ...extraWhere))
        .as("distinct_campaign_purchases");
}

/**
 * LEFT-JOIN predicate for resolving a wallet address from an asset_log's
 * `identityGroupId`. Filters identity_nodes to the canonical wallet row:
 * type=wallet, no merchant scope, not unlinked. Used by both the
 * stats-list `uniqueWallets` aggregate and the details leaderboard.
 */
export function walletIdentityJoinOn(): SQL {
    return and(
        eq(assetLogsTable.identityGroupId, identityNodesTable.groupId),
        eq(identityNodesTable.identityType, "wallet"),
        isNull(identityNodesTable.merchantId),
        isNull(identityNodesTable.unlinkedAt)
    ) as SQL;
}
