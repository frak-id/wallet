import { HttpError, isUuid } from "@backend-utils";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { isAddress } from "viem";
import { referralLinksTable } from "../../domain/attribution/db/schema";
import {
    identityGroupsTable,
    identityNodesTable,
} from "../../domain/identity/db/schema";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { InstagramLinkRepository } from "../../domain/instagram/repositories/InstagramLinkRepository";
import type { InstagramPendingLinkRepository } from "../../domain/instagram/repositories/InstagramPendingLinkRepository";
import { instagramLevelOf } from "../../domain/instagram/utils";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../../domain/rewards/db/schema";
import { db } from "../../infrastructure/persistence/postgres";
import type { IdentityLookup } from "../schemas/internalSchemas";

const PAGE_SIZE = 100;

type ReferralLinkSelect = typeof referralLinksTable.$inferSelect;

function linkView(link: ReferralLinkSelect) {
    return {
        id: link.id,
        scope: link.scope,
        merchantId: link.merchantId,
        referrerIdentityGroupId: link.referrerIdentityGroupId,
        refereeIdentityGroupId: link.refereeIdentityGroupId,
        source: link.source,
        createdAt: link.createdAt,
        removedAt: link.removedAt,
        endReason: link.endReason,
    };
}

async function page<T>(
    rows: Promise<T[]>,
    total: Promise<{ n: number }[]>
): Promise<{ total: number; items: T[] }> {
    const [items, [counted]] = await Promise.all([rows, total]);
    return { total: counted?.n ?? 0, items };
}

/** Support view of one person: their identity, referral links, interactions and rewards. */
export class IdentityLookupOrchestrator {
    constructor(
        private readonly identities: Pick<
            IdentityRepository,
            "findSurvivingGroupId"
        >,
        private readonly instagramLinks: Pick<
            InstagramLinkRepository,
            "findByIdentityGroups"
        >,
        private readonly instagramPendingLinks: Pick<
            InstagramPendingLinkRepository,
            "findDeclarations"
        >
    ) {}

    /** By wallet address, email or identity group id; `null` when it matches nobody. */
    async lookup(query: string): Promise<IdentityLookup | null> {
        const groupIds = await this.resolveGroups(query.trim());
        if (groupIds.length === 0) return null;

        const [groups, nodes, links, declarations] = await Promise.all([
            db
                .select()
                .from(identityGroupsTable)
                .where(inArray(identityGroupsTable.id, groupIds)),
            db
                .select()
                .from(identityNodesTable)
                .where(inArray(identityNodesTable.groupId, groupIds))
                .orderBy(identityNodesTable.createdAt),
            this.instagramLinks.findByIdentityGroups(groupIds),
            this.instagramPendingLinks.findDeclarations(groupIds),
        ]);
        const [referrers, referees, interactions, assets] = await Promise.all([
            this.linksOf(referralLinksTable.refereeIdentityGroupId, groupIds),
            this.linksOf(referralLinksTable.referrerIdentityGroupId, groupIds),
            this.interactionsOf(groupIds),
            this.assetsOf(groupIds),
        ]);

        return {
            groups: groups.map((group) => ({
                id: group.id,
                createdAt: group.createdAt,
                mergedGroupIds: (group.mergedGroups ?? []).map(
                    (merged) => merged.groupId
                ),
                nodes: nodes
                    .filter((node) => node.groupId === group.id)
                    .map((node) => ({
                        type: node.identityType,
                        value: node.identityValue,
                        merchantId: node.merchantId,
                        createdAt: node.createdAt,
                        unlinkedAt: node.unlinkedAt,
                    })),
            })),
            instagram: groupIds.flatMap((identityGroupId) => {
                const link =
                    links.find((l) => l.identityGroupId === identityGroupId) ??
                    null;
                const declaration =
                    declarations.find(
                        (d) => d.identityGroupId === identityGroupId
                    ) ?? null;
                if (!link && !declaration) return [];
                return [
                    {
                        identityGroupId,
                        level: instagramLevelOf(link, declaration),
                        username:
                            link?.username ?? declaration?.username ?? null,
                        follows: link?.follows ?? null,
                    },
                ];
            }),
            referrers: referrers.items.map(linkView),
            referees: {
                total: referees.total,
                items: referees.items.map(linkView),
            },
            interactions,
            assets,
        };
    }

    private async resolveGroups(query: string): Promise<string[]> {
        if (isUuid(query)) {
            const surviving = await this.identities.findSurvivingGroupId(query);
            return surviving ? [surviving] : [];
        }
        const type = isAddress(query)
            ? "wallet"
            : query.includes("@")
              ? "email"
              : null;
        if (!type) {
            throw HttpError.badRequest(
                "INVALID_LOOKUP",
                "Search by wallet address, email or identity group id"
            );
        }
        const nodes = await db
            .selectDistinct({ groupId: identityNodesTable.groupId })
            .from(identityNodesTable)
            .where(
                and(
                    eq(identityNodesTable.identityType, type),
                    eq(identityNodesTable.identityValue, query.toLowerCase())
                )
            );
        return nodes.map((node) => node.groupId);
    }

    private linksOf(
        column:
            | typeof referralLinksTable.referrerIdentityGroupId
            | typeof referralLinksTable.refereeIdentityGroupId,
        groupIds: string[]
    ) {
        const where = inArray(column, groupIds);
        return page(
            db
                .select()
                .from(referralLinksTable)
                .where(where)
                .orderBy(desc(referralLinksTable.createdAt))
                .limit(PAGE_SIZE),
            db.select({ n: count() }).from(referralLinksTable).where(where)
        );
    }

    private interactionsOf(groupIds: string[]) {
        const where = inArray(interactionLogsTable.identityGroupId, groupIds);
        return page(
            db
                .select({
                    id: interactionLogsTable.id,
                    type: interactionLogsTable.type,
                    merchantId: interactionLogsTable.merchantId,
                    createdAt: interactionLogsTable.createdAt,
                    cancelledAt: interactionLogsTable.cancelledAt,
                    payload: interactionLogsTable.payload,
                })
                .from(interactionLogsTable)
                .where(where)
                .orderBy(desc(interactionLogsTable.createdAt))
                .limit(PAGE_SIZE),
            db.select({ n: count() }).from(interactionLogsTable).where(where)
        );
    }

    private assetsOf(groupIds: string[]) {
        const where = inArray(assetLogsTable.identityGroupId, groupIds);
        return page(
            db
                .select({
                    id: assetLogsTable.id,
                    assetType: assetLogsTable.assetType,
                    amount: assetLogsTable.amount,
                    status: assetLogsTable.status,
                    recipientType: assetLogsTable.recipientType,
                    recipientWallet: assetLogsTable.recipientWallet,
                    merchantId: assetLogsTable.merchantId,
                    createdAt: assetLogsTable.createdAt,
                    onchainTxHash: assetLogsTable.onchainTxHash,
                })
                .from(assetLogsTable)
                .where(where)
                .orderBy(desc(assetLogsTable.createdAt))
                .limit(PAGE_SIZE),
            db.select({ n: count() }).from(assetLogsTable).where(where)
        );
    }
}
