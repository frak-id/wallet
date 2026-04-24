import { db, log } from "@backend-infrastructure";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
    referralLinksTable,
    touchpointsTable,
} from "../../domain/attribution/db/schema";
import {
    identityGroupsTable,
    identityNodesTable,
    type MergedGroup,
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

    private async deleteConflictingRefereeLinksInTrx(
        trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
        anchorGroupId: string,
        mergingGroupId: string
    ): Promise<number> {
        // Merchant-scoped conflicts: the anchor already has a referrer for
        // some merchants, so merging's referee rows on those same merchants
        // would violate the partial unique on (merchant_id, referee) after
        // the referee migration.
        const anchorMerchantRefereeLinks = await trx
            .select({ merchantId: referralLinksTable.merchantId })
            .from(referralLinksTable)
            .where(
                and(
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        anchorGroupId
                    ),
                    eq(referralLinksTable.scope, "merchant")
                )
            );

        const anchorMerchantIds = anchorMerchantRefereeLinks
            .map((l) => l.merchantId)
            .filter((id): id is string => id !== null);

        let deleted = 0;

        if (anchorMerchantIds.length > 0) {
            const deletedMerchantResult = await trx
                .delete(referralLinksTable)
                .where(
                    and(
                        eq(
                            referralLinksTable.refereeIdentityGroupId,
                            mergingGroupId
                        ),
                        eq(referralLinksTable.scope, "merchant"),
                        // `inArray` rejects nullable columns in the current
                        // Drizzle version; raw-SQL snippet keeps the same
                        // semantics without losing the NOT NULL implication.
                        sql`${referralLinksTable.merchantId} IN (${sql.join(
                            anchorMerchantIds.map((id) => sql`${id}::uuid`),
                            sql`, `
                        )})`
                    )
                )
                .returning({ id: referralLinksTable.id });
            deleted += deletedMerchantResult.length;
        }

        // Cross-merchant conflict: the `(referee) WHERE scope='cross_merchant'`
        // partial unique allows only one row per user; drop the merging row
        // if the anchor already has one.
        const [anchorCrossMerchant] = await trx
            .select({ id: referralLinksTable.id })
            .from(referralLinksTable)
            .where(
                and(
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        anchorGroupId
                    ),
                    eq(referralLinksTable.scope, "cross_merchant")
                )
            )
            .limit(1);

        if (anchorCrossMerchant) {
            const deletedCrossResult = await trx
                .delete(referralLinksTable)
                .where(
                    and(
                        eq(
                            referralLinksTable.refereeIdentityGroupId,
                            mergingGroupId
                        ),
                        eq(referralLinksTable.scope, "cross_merchant")
                    )
                )
                .returning({ id: referralLinksTable.id });
            deleted += deletedCrossResult.length;
        }

        return deleted;
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
