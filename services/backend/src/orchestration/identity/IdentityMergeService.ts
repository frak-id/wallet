import { db, log } from "@backend-infrastructure";
import { and, eq, inArray } from "drizzle-orm";
import {
    referralLinksTable,
    touchpointsTable,
} from "../../domain/attribution/db/schema";
import {
    identityGroupsTable,
    identityNodesTable,
    type MergedGroup,
    pendingIdentityResolutionsTable,
} from "../../domain/identity/db/schema";
import {
    purchaseClaimsTable,
    purchasesTable,
} from "../../domain/purchases/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../../domain/rewards/db/schema";

type MergeResult = {
    success: boolean;
    movedNodes: number;
    migratedPurchases: number;
    migratedPurchaseClaims: number;
    migratedInteractionLogs: number;
    migratedAssetLogs: number;
    migratedTouchpoints: number;
    migratedReferralLinksReferrer: number;
    migratedReferralLinksReferee: number;
    deletedConflictingReferralLinks: number;
    deletedPendingResolutions: number;
};

type BatchMergeResult = MergeResult & {
    mergedGroupIds: string[];
    previouslyMergedGroupIds: string[];
};

export class IdentityMergeService {
    async mergeMultipleGroups(params: {
        anchorGroupId: string;
        mergingGroupIds: string[];
    }): Promise<BatchMergeResult> {
        const { anchorGroupId, mergingGroupIds } = params;

        if (mergingGroupIds.length === 0) {
            return {
                success: true,
                movedNodes: 0,
                migratedPurchases: 0,
                migratedPurchaseClaims: 0,
                migratedInteractionLogs: 0,
                migratedAssetLogs: 0,
                migratedTouchpoints: 0,
                migratedReferralLinksReferrer: 0,
                migratedReferralLinksReferee: 0,
                deletedConflictingReferralLinks: 0,
                deletedPendingResolutions: 0,
                mergedGroupIds: [],
                previouslyMergedGroupIds: [],
            };
        }

        return db.transaction(async (trx) => {
            const allGroupIds = [anchorGroupId, ...mergingGroupIds];
            const lockedGroups = await trx
                .select()
                .from(identityGroupsTable)
                .where(inArray(identityGroupsTable.id, allGroupIds))
                .for("update");

            const mergingGroups = lockedGroups.filter((g) =>
                mergingGroupIds.includes(g.id)
            );

            const previouslyMergedGroupIds = mergingGroups.flatMap((g) =>
                ((g.mergedGroups as MergedGroup[] | null) ?? []).map(
                    (mg) => mg.groupId
                )
            );

            const movedNodesResult = await trx
                .update(identityNodesTable)
                .set({ groupId: anchorGroupId })
                .where(inArray(identityNodesTable.groupId, mergingGroupIds))
                .returning({ id: identityNodesTable.id });

            const migratedPurchasesResult = await trx
                .update(purchasesTable)
                .set({ identityGroupId: anchorGroupId, updatedAt: new Date() })
                .where(inArray(purchasesTable.identityGroupId, mergingGroupIds))
                .returning({ id: purchasesTable.id });

            const migratedInteractionLogsResult = await trx
                .update(interactionLogsTable)
                .set({ identityGroupId: anchorGroupId })
                .where(
                    inArray(
                        interactionLogsTable.identityGroupId,
                        mergingGroupIds
                    )
                )
                .returning({ id: interactionLogsTable.id });

            const migratedAssetLogsResult = await trx
                .update(assetLogsTable)
                .set({ identityGroupId: anchorGroupId })
                .where(inArray(assetLogsTable.identityGroupId, mergingGroupIds))
                .returning({ id: assetLogsTable.id });

            const migratedTouchpointsResult = await trx
                .update(touchpointsTable)
                .set({ identityGroupId: anchorGroupId })
                .where(
                    inArray(touchpointsTable.identityGroupId, mergingGroupIds)
                )
                .returning({ id: touchpointsTable.id });

            const migratedReferrerResult = await trx
                .update(referralLinksTable)
                .set({ referrerIdentityGroupId: anchorGroupId })
                .where(
                    inArray(
                        referralLinksTable.referrerIdentityGroupId,
                        mergingGroupIds
                    )
                )
                .returning({ id: referralLinksTable.id });

            let deletedConflicts = 0;
            for (const mergingGroupId of mergingGroupIds) {
                deletedConflicts +=
                    await this.deleteConflictingRefereeLinksInTrx(
                        trx,
                        anchorGroupId,
                        mergingGroupId
                    );
            }

            const migratedRefereeResult = await trx
                .update(referralLinksTable)
                .set({ refereeIdentityGroupId: anchorGroupId })
                .where(
                    inArray(
                        referralLinksTable.refereeIdentityGroupId,
                        mergingGroupIds
                    )
                )
                .returning({ id: referralLinksTable.id });

            const migratedPurchaseClaimsResult = await trx
                .update(purchaseClaimsTable)
                .set({ claimingIdentityGroupId: anchorGroupId })
                .where(
                    inArray(
                        purchaseClaimsTable.claimingIdentityGroupId,
                        mergingGroupIds
                    )
                )
                .returning({ id: purchaseClaimsTable.id });

            const deletedPendingResolutionsResult = await trx
                .delete(pendingIdentityResolutionsTable)
                .where(
                    inArray(
                        pendingIdentityResolutionsTable.groupId,
                        mergingGroupIds
                    )
                )
                .returning({ id: pendingIdentityResolutionsTable.id });

            await this.updateAnchorMergedGroupsBatchInTrx(
                trx,
                anchorGroupId,
                mergingGroups
            );

            await trx
                .delete(identityGroupsTable)
                .where(inArray(identityGroupsTable.id, mergingGroupIds));

            const result: BatchMergeResult = {
                success: true,
                movedNodes: movedNodesResult.length,
                migratedPurchases: migratedPurchasesResult.length,
                migratedPurchaseClaims: migratedPurchaseClaimsResult.length,
                migratedInteractionLogs: migratedInteractionLogsResult.length,
                migratedAssetLogs: migratedAssetLogsResult.length,
                migratedTouchpoints: migratedTouchpointsResult.length,
                migratedReferralLinksReferrer: migratedReferrerResult.length,
                migratedReferralLinksReferee: migratedRefereeResult.length,
                deletedConflictingReferralLinks: deletedConflicts,
                deletedPendingResolutions:
                    deletedPendingResolutionsResult.length,
                mergedGroupIds: mergingGroupIds,
                previouslyMergedGroupIds,
            };

            log.info(
                { anchorGroupId, mergingGroupIds, ...result },
                "Batch merged identity groups"
            );

            return result;
        });
    }

    private async updateAnchorMergedGroupsBatchInTrx(
        trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
        anchorGroupId: string,
        mergingGroups: (typeof identityGroupsTable.$inferSelect)[]
    ): Promise<void> {
        const anchorGroup = await trx.query.identityGroupsTable.findFirst({
            where: eq(identityGroupsTable.id, anchorGroupId),
        });

        const existingMergedGroups: MergedGroup[] =
            (anchorGroup?.mergedGroups as MergedGroup[] | null) ?? [];

        const inheritedMergedGroups: MergedGroup[] = mergingGroups.flatMap(
            (g) => (g.mergedGroups as MergedGroup[] | null) ?? []
        );

        const newMergedGroups: MergedGroup[] = mergingGroups.map((g) => ({
            groupId: g.id,
            mergedAt: new Date().toISOString(),
        }));

        const updatedMergedGroups = [
            ...existingMergedGroups,
            ...inheritedMergedGroups,
            ...newMergedGroups,
        ];

        await trx
            .update(identityGroupsTable)
            .set({ mergedGroups: updatedMergedGroups, updatedAt: new Date() })
            .where(eq(identityGroupsTable.id, anchorGroupId));
    }

    async mergeGroups(params: {
        anchorGroupId: string;
        mergingGroupId: string;
    }): Promise<MergeResult> {
        const { anchorGroupId, mergingGroupId } = params;

        return db.transaction(async (trx) => {
            const [lockedGroups] = await Promise.all([
                trx
                    .select()
                    .from(identityGroupsTable)
                    .where(
                        inArray(identityGroupsTable.id, [
                            anchorGroupId,
                            mergingGroupId,
                        ])
                    )
                    .for("update"),
            ]);

            const mergingGroup = lockedGroups.find(
                (g) => g.id === mergingGroupId
            );

            const movedNodesResult = await trx
                .update(identityNodesTable)
                .set({ groupId: anchorGroupId })
                .where(eq(identityNodesTable.groupId, mergingGroupId))
                .returning({ id: identityNodesTable.id });

            const migratedPurchasesResult = await trx
                .update(purchasesTable)
                .set({
                    identityGroupId: anchorGroupId,
                    updatedAt: new Date(),
                })
                .where(eq(purchasesTable.identityGroupId, mergingGroupId))
                .returning({ id: purchasesTable.id });

            const migratedInteractionLogsResult = await trx
                .update(interactionLogsTable)
                .set({ identityGroupId: anchorGroupId })
                .where(eq(interactionLogsTable.identityGroupId, mergingGroupId))
                .returning({ id: interactionLogsTable.id });

            const migratedAssetLogsResult = await trx
                .update(assetLogsTable)
                .set({ identityGroupId: anchorGroupId })
                .where(eq(assetLogsTable.identityGroupId, mergingGroupId))
                .returning({ id: assetLogsTable.id });

            const migratedTouchpointsResult = await trx
                .update(touchpointsTable)
                .set({ identityGroupId: anchorGroupId })
                .where(eq(touchpointsTable.identityGroupId, mergingGroupId))
                .returning({ id: touchpointsTable.id });

            const migratedReferrerResult = await trx
                .update(referralLinksTable)
                .set({ referrerIdentityGroupId: anchorGroupId })
                .where(
                    eq(
                        referralLinksTable.referrerIdentityGroupId,
                        mergingGroupId
                    )
                )
                .returning({ id: referralLinksTable.id });

            const deletedConflicts =
                await this.deleteConflictingRefereeLinksInTrx(
                    trx,
                    anchorGroupId,
                    mergingGroupId
                );

            const migratedRefereeResult = await trx
                .update(referralLinksTable)
                .set({ refereeIdentityGroupId: anchorGroupId })
                .where(
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        mergingGroupId
                    )
                )
                .returning({ id: referralLinksTable.id });

            const migratedPurchaseClaimsResult = await trx
                .update(purchaseClaimsTable)
                .set({ claimingIdentityGroupId: anchorGroupId })
                .where(
                    eq(
                        purchaseClaimsTable.claimingIdentityGroupId,
                        mergingGroupId
                    )
                )
                .returning({ id: purchaseClaimsTable.id });

            const deletedPendingResolutionsResult = await trx
                .delete(pendingIdentityResolutionsTable)
                .where(
                    eq(pendingIdentityResolutionsTable.groupId, mergingGroupId)
                )
                .returning({ id: pendingIdentityResolutionsTable.id });

            await this.updateAnchorMergedGroupsInTrx(
                trx,
                anchorGroupId,
                mergingGroupId,
                mergingGroup?.mergedGroups as MergedGroup[] | null
            );

            await trx
                .delete(identityGroupsTable)
                .where(eq(identityGroupsTable.id, mergingGroupId));

            const result: MergeResult = {
                success: true,
                movedNodes: movedNodesResult.length,
                migratedPurchases: migratedPurchasesResult.length,
                migratedPurchaseClaims: migratedPurchaseClaimsResult.length,
                migratedInteractionLogs: migratedInteractionLogsResult.length,
                migratedAssetLogs: migratedAssetLogsResult.length,
                migratedTouchpoints: migratedTouchpointsResult.length,
                migratedReferralLinksReferrer: migratedReferrerResult.length,
                migratedReferralLinksReferee: migratedRefereeResult.length,
                deletedConflictingReferralLinks: deletedConflicts,
                deletedPendingResolutions:
                    deletedPendingResolutionsResult.length,
            };

            log.info(
                {
                    anchorGroupId,
                    mergingGroupId,
                    ...result,
                },
                "Identity groups merged successfully"
            );

            return result;
        });
    }

    async getMergedGroupIds(groupId: string): Promise<string[]> {
        const group = await db.query.identityGroupsTable.findFirst({
            where: eq(identityGroupsTable.id, groupId),
        });

        if (!group?.mergedGroups) {
            return [];
        }

        const mergedGroups = group.mergedGroups as MergedGroup[];
        return mergedGroups.map((mg) => mg.groupId);
    }

    private async deleteConflictingRefereeLinksInTrx(
        trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
        anchorGroupId: string,
        mergingGroupId: string
    ): Promise<number> {
        const anchorRefereeLinks = await trx
            .select({ merchantId: referralLinksTable.merchantId })
            .from(referralLinksTable)
            .where(
                eq(referralLinksTable.refereeIdentityGroupId, anchorGroupId)
            );

        const anchorMerchantIds = anchorRefereeLinks.map((l) => l.merchantId);

        if (anchorMerchantIds.length === 0) {
            return 0;
        }

        const deletedResult = await trx
            .delete(referralLinksTable)
            .where(
                and(
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        mergingGroupId
                    ),
                    inArray(referralLinksTable.merchantId, anchorMerchantIds)
                )
            )
            .returning({ id: referralLinksTable.id });

        return deletedResult.length;
    }

    private async updateAnchorMergedGroupsInTrx(
        trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
        anchorGroupId: string,
        mergingGroupId: string,
        mergingGroupMergedGroups: MergedGroup[] | null
    ): Promise<void> {
        const anchorGroup = await trx.query.identityGroupsTable.findFirst({
            where: eq(identityGroupsTable.id, anchorGroupId),
        });

        const existingMergedGroups: MergedGroup[] =
            (anchorGroup?.mergedGroups as MergedGroup[] | null) ?? [];

        const inheritedMergedGroups: MergedGroup[] =
            mergingGroupMergedGroups ?? [];

        const newMergedGroup: MergedGroup = {
            groupId: mergingGroupId,
            mergedAt: new Date().toISOString(),
        };

        const updatedMergedGroups = [
            ...existingMergedGroups,
            ...inheritedMergedGroups,
            newMergedGroup,
        ];

        await trx
            .update(identityGroupsTable)
            .set({
                mergedGroups: updatedMergedGroups,
                updatedAt: new Date(),
            })
            .where(eq(identityGroupsTable.id, anchorGroupId));
    }
}
