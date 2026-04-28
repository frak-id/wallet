import { db, log } from "@backend-infrastructure";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { referralLinksTable } from "../../domain/attribution/db/schema";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
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
    migratedReferralLinksReferrer: number;
    migratedReferralLinksReferee: number;
    softDeletedConflictingReferralLinks: number;
    // Rows whose referrer and referee both belonged to the merge set before
    // the referrer/referee updates were applied. Left alone, they would have
    // become `(anchor, anchor)` self-loops (see softDeleteSelfLoopCandidatesInTrx).
    softDeletedSelfLoopReferralLinks: number;
};

type BatchMergeResult = MergeResult & {
    mergedGroupIds: string[];
    previouslyMergedGroupIds: string[];
};

export class IdentityMergeService {
    constructor(
        private readonly referralLinkRepository: ReferralLinkRepository
    ) {}

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
                migratedReferralLinksReferrer: 0,
                migratedReferralLinksReferee: 0,
                softDeletedConflictingReferralLinks: 0,
                softDeletedSelfLoopReferralLinks: 0,
                mergedGroupIds: [],
                previouslyMergedGroupIds: [],
            };
        }

        const result = await db.transaction(async (trx) => {
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

            // Self-loop guard: any referral_links row where BOTH endpoints
            // are in the merge set would collapse to `(anchor, anchor)` once
            // the bulk referrer/referee updates run — violating the
            // `referral_links_no_self_loop_check` CHECK constraint and
            // breaking chain walkers / reward distribution. Active rows are
            // soft-deleted with `end_reason='merged'` (audit preserved);
            // already-soft-deleted rows are skipped because the bulk updates
            // below also filter `removed_at IS NULL`, so they keep their
            // original endpoints and pose no CHECK risk. Must run BEFORE the
            // referrer/referee updates.
            const softDeletedSelfLoops =
                await this.softDeleteSelfLoopCandidatesInTrx(trx, allGroupIds);

            const migratedReferrerResult = await trx
                .update(referralLinksTable)
                .set({ referrerIdentityGroupId: anchorGroupId })
                .where(
                    and(
                        inArray(
                            referralLinksTable.referrerIdentityGroupId,
                            mergingGroupIds
                        ),
                        // Only re-anchor active rows. Soft-deleted rows are
                        // immutable history — they keep their original
                        // referrer pointer (now referencing a deleted group)
                        // for audit, and are invisible to all live readers.
                        isNull(referralLinksTable.removedAt)
                    )
                )
                .returning({ id: referralLinksTable.id });

            let softDeletedConflicts = 0;
            for (const mergingGroupId of mergingGroupIds) {
                softDeletedConflicts +=
                    await this.softDeleteConflictingRefereeLinksInTrx(
                        trx,
                        anchorGroupId,
                        mergingGroupId
                    );
            }

            const migratedRefereeResult = await trx
                .update(referralLinksTable)
                .set({ refereeIdentityGroupId: anchorGroupId })
                .where(
                    and(
                        inArray(
                            referralLinksTable.refereeIdentityGroupId,
                            mergingGroupIds
                        ),
                        // Same rationale as the referrer update.
                        isNull(referralLinksTable.removedAt)
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
                migratedReferralLinksReferrer: migratedReferrerResult.length,
                migratedReferralLinksReferee: migratedRefereeResult.length,
                softDeletedConflictingReferralLinks: softDeletedConflicts,
                softDeletedSelfLoopReferralLinks: softDeletedSelfLoops,
                mergedGroupIds: mergingGroupIds,
                previouslyMergedGroupIds,
            };

            log.info(
                { anchorGroupId, mergingGroupIds, ...result },
                "Batch merged identity groups"
            );

            return result;
        });

        this.referralLinkRepository.clearChainCache();

        return result;
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

        const result = await db.transaction(async (trx) => {
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

            // Self-loop guard — see mergeMultipleGroups for the full rationale.
            // Must run BEFORE the referrer/referee updates that would otherwise
            // collapse `(anchor, merging)` or `(merging, anchor)` rows to
            // `(anchor, anchor)`.
            const softDeletedSelfLoops =
                await this.softDeleteSelfLoopCandidatesInTrx(trx, [
                    anchorGroupId,
                    mergingGroupId,
                ]);

            const migratedReferrerResult = await trx
                .update(referralLinksTable)
                .set({ referrerIdentityGroupId: anchorGroupId })
                .where(
                    and(
                        eq(
                            referralLinksTable.referrerIdentityGroupId,
                            mergingGroupId
                        ),
                        isNull(referralLinksTable.removedAt)
                    )
                )
                .returning({ id: referralLinksTable.id });

            const softDeletedConflicts =
                await this.softDeleteConflictingRefereeLinksInTrx(
                    trx,
                    anchorGroupId,
                    mergingGroupId
                );

            const migratedRefereeResult = await trx
                .update(referralLinksTable)
                .set({ refereeIdentityGroupId: anchorGroupId })
                .where(
                    and(
                        eq(
                            referralLinksTable.refereeIdentityGroupId,
                            mergingGroupId
                        ),
                        isNull(referralLinksTable.removedAt)
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
                migratedReferralLinksReferrer: migratedReferrerResult.length,
                migratedReferralLinksReferee: migratedRefereeResult.length,
                softDeletedConflictingReferralLinks: softDeletedConflicts,
                softDeletedSelfLoopReferralLinks: softDeletedSelfLoops,
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

        // See `mergeMultipleGroups` for the rationale.
        this.referralLinkRepository.clearChainCache();

        return result;
    }

    /**
     * Soft-delete the merging group's active referee links that would
     * conflict with anchor's active referee links once the bulk referee
     * update runs.
     *
     * Soft-delete (vs hard-delete) preserves the audit trail with
     * `end_reason='merged'`; the partial unique indexes on `referral_links`
     * already filter `removed_at IS NULL`, so the post-update state cleanly
     * satisfies them.
     *
     * Conflicts are looked up against ANCHOR's ACTIVE rows only — anchor's
     * own soft-deleted rows do not occupy a uniqueness slot under the new
     * partial uniques, so they should not trigger removal of merging's
     * active rows.
     */
    private async softDeleteConflictingRefereeLinksInTrx(
        trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
        anchorGroupId: string,
        mergingGroupId: string
    ): Promise<number> {
        const now = new Date();

        // Merchant-scoped conflicts: only ACTIVE anchor rows count.
        const anchorMerchantRefereeLinks = await trx
            .select({ merchantId: referralLinksTable.merchantId })
            .from(referralLinksTable)
            .where(
                and(
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        anchorGroupId
                    ),
                    eq(referralLinksTable.scope, "merchant"),
                    isNull(referralLinksTable.removedAt)
                )
            );

        const anchorMerchantIds = anchorMerchantRefereeLinks
            .map((l) => l.merchantId)
            .filter((id): id is string => id !== null);

        let softDeleted = 0;

        if (anchorMerchantIds.length > 0) {
            const softDeletedMerchantResult = await trx
                .update(referralLinksTable)
                .set({ removedAt: now, endReason: "merged" })
                .where(
                    and(
                        eq(
                            referralLinksTable.refereeIdentityGroupId,
                            mergingGroupId
                        ),
                        eq(referralLinksTable.scope, "merchant"),
                        // Only mark active rows; idempotent if re-run.
                        isNull(referralLinksTable.removedAt),
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
            softDeleted += softDeletedMerchantResult.length;
        }

        // Cross-merchant conflict: only ACTIVE anchor rows count.
        const [anchorCrossMerchant] = await trx
            .select({ id: referralLinksTable.id })
            .from(referralLinksTable)
            .where(
                and(
                    eq(
                        referralLinksTable.refereeIdentityGroupId,
                        anchorGroupId
                    ),
                    eq(referralLinksTable.scope, "cross_merchant"),
                    isNull(referralLinksTable.removedAt)
                )
            )
            .limit(1);

        if (anchorCrossMerchant) {
            const softDeletedCrossResult = await trx
                .update(referralLinksTable)
                .set({ removedAt: now, endReason: "merged" })
                .where(
                    and(
                        eq(
                            referralLinksTable.refereeIdentityGroupId,
                            mergingGroupId
                        ),
                        eq(referralLinksTable.scope, "cross_merchant"),
                        isNull(referralLinksTable.removedAt)
                    )
                )
                .returning({ id: referralLinksTable.id });
            softDeleted += softDeletedCrossResult.length;
        }

        return softDeleted;
    }

    /**
     * Soft-delete referral_links rows that would collapse to a self-loop
     * (`referrer = referee`) once identity groups are merged.
     *
     * Covers two classes of rows:
     *  - `(anchor, merging)` / `(merging, anchor)` in either scope — the
     *    referrer/referee update steps would flip the orphan endpoint to
     *    `anchor`, producing `(anchor, anchor)`.
     *  - `(merging_i, merging_j)` when more than one group is merging at
     *    once (from `mergeMultipleGroups`) — both endpoints become `anchor`.
     *
     * Only ACTIVE rows are touched. Soft-deleted rows in the same shape are
     * left alone: the bulk referrer/referee updates also filter
     * `removed_at IS NULL`, so they retain their original endpoints (no
     * CHECK violation, audit preserved).
     *
     * Must run BEFORE the referrer/referee migrations in the transaction.
     * Self-loops break chain-walker termination logic (path guard still
     * works but an extra hop is wasted) and, worse, would cause the reward
     * pipeline to credit users as their own referrer via
     * `findReferrerForReferee`.
     */
    private async softDeleteSelfLoopCandidatesInTrx(
        trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
        allGroupIds: string[]
    ): Promise<number> {
        const result = await trx
            .update(referralLinksTable)
            .set({ removedAt: new Date(), endReason: "merged" })
            .where(
                and(
                    inArray(
                        referralLinksTable.referrerIdentityGroupId,
                        allGroupIds
                    ),
                    inArray(
                        referralLinksTable.refereeIdentityGroupId,
                        allGroupIds
                    ),
                    isNull(referralLinksTable.removedAt)
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
