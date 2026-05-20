import { db, log } from "@backend-infrastructure";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Address } from "viem";
import { referralLinksTable } from "../../domain/attribution/db/schema";
import type { ReferralLinkRepository } from "../../domain/attribution/repositories/ReferralLinkRepository";
import {
    identityGroupsTable,
    identityNodesTable,
    type MergedGroup,
} from "../../domain/identity/db/schema";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import { pushTokensTable } from "../../domain/notifications/db/schema";
import {
    purchaseClaimsTable,
    purchasesTable,
} from "../../domain/purchases/db/schema";
import { referralCodesTable } from "../../domain/referral-code/db/schema";
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
    // Push-token migration counters. `push_tokens` is wallet-keyed; the
    // numbers stay zero when neither side has any wallet identity node.
    movedPushTokens: number;
    deletedPushTokens: number;
    // Referral-code counters. Identity-keyed so they always run.
    revokedConflictingReferralCodes: number;
    migratedReferralCodes: number;
    // Group ids that were successfully merged into the anchor.
    mergedGroupIds: string[];
    // Groups that the losers had previously absorbed — those ids are now
    // transitively owned by the anchor.
    previouslyMergedGroupIds: string[];
};

export class IdentityMergeService {
    constructor(
        private readonly referralLinkRepository: ReferralLinkRepository,
        private readonly identityRepository: IdentityRepository
    ) {}

    /**
     * Merge one-or-many `mergingGroupIds` into `anchorGroupId`. Every
     * identity-keyed table is rewritten in a single PG transaction; the
     * wallet-keyed `push_tokens` rows are migrated too when both sides
     * have wallet identity nodes.
     *
     * No-op when `mergingGroupIds` is empty.
     */
    async mergeGroups(params: {
        anchorGroupId: string;
        mergingGroupIds: string[];
    }): Promise<MergeResult> {
        const { anchorGroupId, mergingGroupIds } = params;

        if (mergingGroupIds.length === 0) {
            return emptyMergeResult();
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

            // Resolve wallet identity nodes BEFORE the bulk node move so
            // we still know which wallets came from which side. Feeds the
            // `push_tokens` migration, which is keyed by `wallet` and has
            // no `identity_group_id` column.
            const walletNodes = await trx
                .select({
                    groupId: identityNodesTable.groupId,
                    identityValue: identityNodesTable.identityValue,
                })
                .from(identityNodesTable)
                .where(
                    and(
                        inArray(identityNodesTable.groupId, allGroupIds),
                        eq(identityNodesTable.identityType, "wallet"),
                        // Skip wallets already soft-unlinked by a prior
                        // merge — their push_tokens are already migrated and
                        // they're no longer the canonical destination.
                        isNull(identityNodesTable.unlinkedAt)
                    )
                );
            const anchorWallets = walletNodes
                .filter((n) => n.groupId === anchorGroupId)
                .map((n) => n.identityValue as Address);
            const loserWallets = walletNodes
                .filter((n) => n.groupId !== anchorGroupId)
                .map((n) => n.identityValue as Address);

            const movedNodesResult = await trx
                .update(identityNodesTable)
                .set({ groupId: anchorGroupId })
                .where(inArray(identityNodesTable.groupId, mergingGroupIds))
                .returning({ id: identityNodesTable.id });

            // Soft-unlink the loser wallet identity nodes so
            // `getWalletForGroup` deterministically resolves to the
            // winner's wallet. We keep the rows in place (`groupId` now
            // points at the anchor) so `findGroupByIdentity` on the loser
            // wallet still resolves to the merged group — preventing stray
            // references from accidentally re-orphaning the address.
            if (loserWallets.length > 0) {
                await trx
                    .update(identityNodesTable)
                    .set({ unlinkedAt: new Date() })
                    .where(
                        and(
                            eq(identityNodesTable.groupId, anchorGroupId),
                            eq(identityNodesTable.identityType, "wallet"),
                            inArray(
                                identityNodesTable.identityValue,
                                loserWallets
                            )
                        )
                    );
            }

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

            const referralCodeOps = await this.migrateReferralCodesInTrx(trx, {
                anchorGroupId,
                mergingGroupIds,
            });

            const pushTokenOps = await this.migratePushTokensInTrx(trx, {
                anchorWallets,
                loserWallets,
            });

            await this.updateAnchorMergedGroupsInTrx(
                trx,
                anchorGroupId,
                mergingGroups
            );

            await trx
                .delete(identityGroupsTable)
                .where(inArray(identityGroupsTable.id, mergingGroupIds));

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
                movedPushTokens: pushTokenOps.movedPushTokens,
                deletedPushTokens: pushTokenOps.deletedPushTokens,
                revokedConflictingReferralCodes:
                    referralCodeOps.revokedConflictingReferralCodes,
                migratedReferralCodes: referralCodeOps.migratedReferralCodes,
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

    private async updateAnchorMergedGroupsInTrx(
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

    /**
     * Wallet-driven entry point. Resolves the identity groups owning the
     * winner / loser wallets, then delegates to `mergeGroups` with both
     * wallets attached so the wallet-keyed ops run inside the same
     * transaction.
     *
     * Idempotent: if both wallets already resolve to the same group (a
     * retry, or a concurrent merge that already absorbed the loser), the
     * call returns a no-op success without entering a transaction.
     */
    async mergeGroupsByWallet(params: {
        winnerWallet: Address;
        loserWallet: Address;
    }): Promise<MergeResult> {
        const { winnerWallet, loserWallet } = params;

        const [winnerGroup, loserGroup] = await Promise.all([
            this.identityRepository.findGroupByIdentity({
                type: "wallet",
                value: winnerWallet,
            }),
            this.identityRepository.findGroupByIdentity({
                type: "wallet",
                value: loserWallet,
            }),
        ]);

        if (!winnerGroup) {
            throw new Error(
                `mergeGroupsByWallet: no identity group for winner wallet ${winnerWallet}`
            );
        }
        if (!loserGroup) {
            throw new Error(
                `mergeGroupsByWallet: no identity group for loser wallet ${loserWallet}`
            );
        }

        if (winnerGroup.id === loserGroup.id) {
            log.info(
                {
                    winnerWallet,
                    loserWallet,
                    groupId: winnerGroup.id,
                },
                "Wallets already share an identity group; skipping merge"
            );
            return emptyMergeResult();
        }

        return this.mergeGroups({
            anchorGroupId: winnerGroup.id,
            mergingGroupIds: [loserGroup.id],
        });
    }

    /**
     * Migrate `push_tokens` rows from loser wallets onto the anchor's
     * primary wallet. `push_tokens` keys by `wallet` (no identity_group_id
     * column), so identity merges can only consolidate the rows by
     * rewriting the `wallet` value.
     *
     * No-op when either side has zero wallet identity nodes (e.g. an
     * anonymous-only merge — nothing keyed by either side anyway).
     *
     * `asset_logs.recipient_wallet` is intentionally NOT touched here:
     * rewards are filtered by `identity_group_id` everywhere in the API,
     * and `recipient_wallet` is the immutable on-chain destination of the
     * original payout — rewriting it would lose audit history.
     */
    private async migratePushTokensInTrx(
        trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
        params: {
            anchorWallets: Address[];
            loserWallets: Address[];
        }
    ): Promise<{
        movedPushTokens: number;
        deletedPushTokens: number;
    }> {
        const { anchorWallets, loserWallets } = params;
        if (loserWallets.length === 0 || anchorWallets.length === 0) {
            return { movedPushTokens: 0, deletedPushTokens: 0 };
        }

        // First anchor wallet is the deterministic destination. Phase 1
        // groups carry exactly one wallet, so this is unambiguous; once
        // multi-wallet groups land the policy may want revisiting.
        const primaryWallet = anchorWallets[0];

        const inserted = await trx.execute<{ id: number }>(sql`
            INSERT INTO push_tokens (wallet, type, endpoint, key_p256dh, key_auth, locale, expire_at, created_at)
            SELECT ${primaryWallet}, type, endpoint, key_p256dh, key_auth, locale, expire_at, created_at
            FROM push_tokens
            WHERE wallet IN (${sql.join(
                loserWallets.map((w) => sql`${w}`),
                sql`, `
            )})
            ON CONFLICT (wallet, type, endpoint) DO NOTHING
            RETURNING id
        `);

        const deleted = await trx
            .delete(pushTokensTable)
            .where(inArray(pushTokensTable.wallet, loserWallets))
            .returning({ id: pushTokensTable.id });

        return {
            movedPushTokens: inserted.length,
            deletedPushTokens: deleted.length,
        };
    }

    /**
     * Migrate `referral_codes` from one-or-many loser groups onto the
     * anchor group. Identity-keyed (uses `owner_identity_group_id`), so it
     * runs for every identity merge — wallet-aware or not.
     *
     * The partial unique `(owner_identity_group_id) WHERE revoked_at IS
     * NULL` requires at most one active code per anchor post-merge. We
     * pre-resolve which active codes survive before the bulk re-own:
     *  - If anchor already has an active code, revoke every loser-side
     *    active code first.
     *  - Otherwise keep the oldest loser-side active code (deterministic
     *    survivor across the batch) and revoke the rest.
     *
     * Historic (already-revoked) loser codes always migrate — they keep
     * the audit trail of who owned which code over time.
     */
    private async migrateReferralCodesInTrx(
        trx: Parameters<Parameters<typeof db.transaction>[0]>[0],
        {
            anchorGroupId,
            mergingGroupIds,
        }: {
            anchorGroupId: string;
            mergingGroupIds: string[];
        }
    ): Promise<{
        revokedConflictingReferralCodes: number;
        migratedReferralCodes: number;
    }> {
        if (mergingGroupIds.length === 0) {
            return {
                revokedConflictingReferralCodes: 0,
                migratedReferralCodes: 0,
            };
        }

        const [winnerActive] = await trx
            .select({ id: referralCodesTable.id })
            .from(referralCodesTable)
            .where(
                and(
                    eq(referralCodesTable.ownerIdentityGroupId, anchorGroupId),
                    isNull(referralCodesTable.revokedAt)
                )
            )
            .limit(1);

        // Loser-side actives, oldest first — used to pick the deterministic
        // survivor when anchor has no active code of its own.
        const loserActives = await trx
            .select({ id: referralCodesTable.id })
            .from(referralCodesTable)
            .where(
                and(
                    inArray(
                        referralCodesTable.ownerIdentityGroupId,
                        mergingGroupIds
                    ),
                    isNull(referralCodesTable.revokedAt)
                )
            )
            .orderBy(referralCodesTable.createdAt);

        const idsToRevoke = winnerActive
            ? loserActives.map((c) => c.id)
            : loserActives.slice(1).map((c) => c.id);

        let revokedConflictingReferralCodes = 0;
        if (idsToRevoke.length > 0) {
            const revoked = await trx
                .update(referralCodesTable)
                .set({ revokedAt: new Date() })
                .where(inArray(referralCodesTable.id, idsToRevoke))
                .returning({ id: referralCodesTable.id });
            revokedConflictingReferralCodes = revoked.length;
        }

        const migrated = await trx
            .update(referralCodesTable)
            .set({ ownerIdentityGroupId: anchorGroupId })
            .where(
                inArray(
                    referralCodesTable.ownerIdentityGroupId,
                    mergingGroupIds
                )
            )
            .returning({ id: referralCodesTable.id });

        return {
            revokedConflictingReferralCodes,
            migratedReferralCodes: migrated.length,
        };
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
     *    once — both endpoints become `anchor`.
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
}

function emptyMergeResult(): MergeResult {
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
        movedPushTokens: 0,
        deletedPushTokens: 0,
        revokedConflictingReferralCodes: 0,
        migratedReferralCodes: 0,
        mergedGroupIds: [],
        previouslyMergedGroupIds: [],
    };
}
