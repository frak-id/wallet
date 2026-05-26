import { db } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import { count, eq, or } from "drizzle-orm";
import { LRUCache } from "lru-cache";
import { type Address, isAddressEqual } from "viem";
import { referralLinksTable } from "../../domain/attribution/db/schema";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import {
    merchantAdminsTable,
    merchantsTable,
} from "../../domain/merchant/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../../domain/rewards/db/schema";
import type { GroupWeight } from "./types";

/**
 * Multiplier applied to merchant ownership / admin counts when computing total
 * weight. Each merchant role is worth this many "activity" units (assets,
 * referrals, interactions). Rationale: losing a business role to a wallet that
 * merely has more activity would silently strip dashboard access — that signal
 * must dominate the activity counters.
 */
const MERCHANT_ROLE_WEIGHT = 10;

export function computeTotalWeight(w: {
    assetsCount: number;
    referralsCount: number;
    interactionsCount: number;
    merchantOwnershipsCount: number;
    merchantAdminshipsCount: number;
}): number {
    return (
        (w.merchantOwnershipsCount + w.merchantAdminshipsCount) *
            MERCHANT_ROLE_WEIGHT +
        w.assetsCount +
        w.referralsCount +
        w.interactionsCount
    );
}

export class IdentityWeightService {
    private readonly weightCache = new LRUCache<string, GroupWeight>({
        max: 5_000,
        ttl: 30_000,
    });

    constructor(private readonly identityRepository: IdentityRepository) {}

    invalidateWeight(groupId: string): void {
        this.weightCache.delete(groupId);
    }

    async getGroupWeight(groupId: string): Promise<GroupWeight> {
        const cached = this.weightCache.get(groupId);
        if (cached) {
            return cached;
        }

        const [
            walletResult,
            assetsResult,
            referralsResult,
            interactionsResult,
        ] = await Promise.all([
            this.identityRepository.getWalletForGroup(groupId),
            this.countAssets(groupId),
            this.countReferrals(groupId),
            this.countInteractions(groupId),
        ]);

        // Merchant roles are wallet-keyed; groups without a wallet cannot hold
        // them, so we skip the queries entirely in that branch.
        const [merchantOwnershipsCount, merchantAdminshipsCount] = walletResult
            ? await Promise.all([
                  this.countMerchantOwnerships(walletResult),
                  this.countMerchantAdminships(walletResult),
              ])
            : [0, 0];

        const weight: GroupWeight = {
            groupId,
            hasWallet: walletResult !== null,
            wallet: walletResult,
            assetsCount: assetsResult,
            referralsCount: referralsResult,
            interactionsCount: interactionsResult,
            merchantOwnershipsCount,
            merchantAdminshipsCount,
        };

        this.weightCache.set(groupId, weight);
        return weight;
    }

    private async countAssets(groupId: string): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(assetLogsTable)
            .where(eq(assetLogsTable.identityGroupId, groupId));
        return result?.value ?? 0;
    }

    private async countReferrals(groupId: string): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(referralLinksTable)
            .where(
                or(
                    eq(referralLinksTable.referrerIdentityGroupId, groupId),
                    eq(referralLinksTable.refereeIdentityGroupId, groupId)
                )
            );
        return result?.value ?? 0;
    }

    private async countInteractions(groupId: string): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(interactionLogsTable)
            .where(eq(interactionLogsTable.identityGroupId, groupId));
        return result?.value ?? 0;
    }

    private async countMerchantOwnerships(wallet: Address): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(merchantsTable)
            .where(eq(merchantsTable.ownerWallet, wallet));
        return result?.value ?? 0;
    }

    private async countMerchantAdminships(wallet: Address): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(merchantAdminsTable)
            .where(eq(merchantAdminsTable.wallet, wallet));
        return result?.value ?? 0;
    }

    determineAnchor(
        weight1: GroupWeight,
        weight2: GroupWeight
    ): {
        anchorGroupId: string;
        mergingGroupId: string;
        anchorWallet: Address | null;
    } {
        const walletResult = this.checkWalletPriority(weight1, weight2);
        if (walletResult) return walletResult;

        const historyWinner = this.compareHistoryWeight(weight1, weight2);
        return {
            anchorGroupId: historyWinner.groupId,
            mergingGroupId:
                historyWinner.groupId === weight1.groupId
                    ? weight2.groupId
                    : weight1.groupId,
            anchorWallet: null,
        };
    }

    determineAnchorFromMultiple(weights: GroupWeight[]): {
        anchorGroupId: string;
        mergingGroupIds: string[];
        anchorWallet: Address | null;
    } {
        if (weights.length === 0) {
            throw new Error("At least one weight required");
        }
        if (weights.length === 1) {
            return {
                anchorGroupId: weights[0].groupId,
                mergingGroupIds: [],
                anchorWallet: weights[0].wallet,
            };
        }

        const walletsWithGroups = weights.filter((w) => w.hasWallet);
        const uniqueWallets = new Set(
            walletsWithGroups.map((w) => w.wallet).filter(Boolean)
        );

        if (uniqueWallets.size > 1) {
            throw HttpError.conflict(
                "WALLET_CONFLICT",
                `Cannot merge groups with different wallets: ${[...uniqueWallets].join(", ")}`
            );
        }

        let anchor: GroupWeight;
        if (walletsWithGroups.length > 0) {
            anchor = walletsWithGroups.reduce((best, current) =>
                this.compareHistoryWeight(best, current) === best
                    ? best
                    : current
            );
        } else {
            anchor = weights.reduce((best, current) =>
                this.compareHistoryWeight(best, current) === best
                    ? best
                    : current
            );
        }

        return {
            anchorGroupId: anchor.groupId,
            mergingGroupIds: weights
                .filter((w) => w.groupId !== anchor.groupId)
                .map((w) => w.groupId),
            anchorWallet: anchor.wallet,
        };
    }

    private checkWalletPriority(
        weight1: GroupWeight,
        weight2: GroupWeight
    ): {
        anchorGroupId: string;
        mergingGroupId: string;
        anchorWallet: Address | null;
    } | null {
        if (weight1.hasWallet && weight2.hasWallet) {
            if (
                weight1.wallet &&
                weight2.wallet &&
                !isAddressEqual(weight1.wallet, weight2.wallet)
            ) {
                throw HttpError.conflict(
                    "WALLET_CONFLICT",
                    `Cannot merge groups with different wallets: ${weight1.wallet} vs ${weight2.wallet}`
                );
            }
            return {
                anchorGroupId: weight1.groupId,
                mergingGroupId: weight2.groupId,
                anchorWallet: weight1.wallet,
            };
        }

        if (weight1.hasWallet) {
            return {
                anchorGroupId: weight1.groupId,
                mergingGroupId: weight2.groupId,
                anchorWallet: weight1.wallet,
            };
        }

        if (weight2.hasWallet) {
            return {
                anchorGroupId: weight2.groupId,
                mergingGroupId: weight1.groupId,
                anchorWallet: weight2.wallet,
            };
        }

        return null;
    }

    private compareHistoryWeight(
        weight1: GroupWeight,
        weight2: GroupWeight
    ): GroupWeight {
        // Primary signal: weighted total (merchant roles count 10x).
        const total1 = computeTotalWeight(weight1);
        const total2 = computeTotalWeight(weight2);
        if (total1 !== total2) {
            return total1 > total2 ? weight1 : weight2;
        }

        // Tiebreaker: per-dimension comparison in priority order so the
        // result stays deterministic when totals collide.
        const comparisons: [number, number][] = [
            [weight1.merchantOwnershipsCount, weight2.merchantOwnershipsCount],
            [weight1.merchantAdminshipsCount, weight2.merchantAdminshipsCount],
            [weight1.assetsCount, weight2.assetsCount],
            [weight1.referralsCount, weight2.referralsCount],
            [weight1.interactionsCount, weight2.interactionsCount],
        ];

        for (const [val1, val2] of comparisons) {
            if (val1 !== val2) {
                return val1 > val2 ? weight1 : weight2;
            }
        }

        return weight1;
    }
}
