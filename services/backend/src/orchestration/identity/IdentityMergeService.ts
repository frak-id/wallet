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
    // Rows whose referrer and referee both belonged to the merge set before
    // the referrer/referee updates were applied. Left alone, they would have
    // become `(anchor, anchor)` self-loops (see deleteSelfLoopCandidatesInTrx).
    deletedSelfLoopReferralLinks: number;
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
                deletedSelfLoopReferralLinks: 0,
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
            // Self-loop guard: delete any referral_links row where BOTH
            // endpoints are in the merge set. Left alone, the referrer/referee
            // updates below would collapse the row to `(anchor, anchor)`,
            // creating a self-referral that breaks chain walkers and reward
            // distribution. Covers anchor↔merging in both directions and
            // merging_i↔merging_j pairs. Must run BEFORE the updates.
            const deletedSelfLoops = await this.deleteSelfLoopCandidatesInTrx(
                trx,
                allGroupIds
            );

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
                deletedSelfLoopReferralLinks: deletedSelfLoops,
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

            // Self-loop guard — see mergeMultipleGroups for the full rationale.
            // Must run BEFORE the referrer/referee updates that would otherwise
            // collapse `(anchor, merging)` or `(merging, anchor)` rows to
            // `(anchor, anchor)`.
            const deletedSelfLoops = await this.deleteSelfLoopCandidatesInTrx(
                trx,
                [anchorGroupId, mergingGroupId]
            );

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
                deletedSelfLoopReferralLinks: deletedSelfLoops,
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

    /**
     * Delete referral_links rows that would collapse to a self-loop
     * (`referrer = referee`) once identity groups are merged.
     *
     * Covers two classes of rows:
     *  - `(anchor, merging)` / `(merging, anchor)` in either scope — the
     *    referrer/referee update steps would flip the orphan endpoint to
     *    `anchor`, producing `(anchor, anchor)`.
     *  - `(merging_i, merging_j)` when more than one group is merging at once
     *    (from `mergeMultipleGroups`) — both endpoints become `anchor`.
     *
     * Must run BEFORE the referrer/referee migrations in the transaction.
     * Self-loops break chain-walker termination logic (path guard still works
     * but an extra hop is wasted) and, worse, would cause the reward pipeline
     * to credit users as their own referrer via `findReferrerForReferee`.
     */
    private async deleteSelfLoopCandidatesInTrx(
        trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
        allGroupIds: string[]
    ): Promise<number> {
        const result = await trx
            .delete(referralLinksTable)
            .where(
                and(
                    inArray(
                        referralLinksTable.referrerIdentityGroupId,
                        allGroupIds
                    ),
                    inArray(
                        referralLinksTable.refereeIdentityGroupId,
                        allGroupIds
                    )
                )
            )
            .returning({ id: referralLinksTable.id });
        return result.length;
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
