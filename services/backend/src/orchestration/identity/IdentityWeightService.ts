import { db } from "@backend-infrastructure";
import { count, eq, or } from "drizzle-orm";
import type { Address } from "viem";
import {
    referralLinksTable,
    touchpointsTable,
} from "../../domain/attribution/db/schema";
import {
    assetLogsTable,
    interactionLogsTable,
} from "../../domain/rewards/db/schema";
import type { GroupWeight } from "./types";

export class IdentityWeightService {
    async getGroupWeight(groupId: string): Promise<GroupWeight> {
        const [
            walletResult,
            assetsResult,
            referralsResult,
            interactionsResult,
            touchpointsResult,
        ] = await Promise.all([
            this.getWalletForGroup(groupId),
            this.countAssets(groupId),
            this.countReferrals(groupId),
            this.countInteractions(groupId),
            this.countTouchpoints(groupId),
        ]);

        return {
            groupId,
            hasWallet: walletResult !== null,
            wallet: walletResult,
            assetsCount: assetsResult,
            referralsCount: referralsResult,
            interactionsCount: interactionsResult,
            touchpointsCount: touchpointsResult,
        };
    }

    async getWalletForGroup(groupId: string): Promise<Address | null> {
        const walletNode = await db.query.identityNodesTable.findFirst({
            where: (table, { and, eq }) =>
                and(
                    eq(table.groupId, groupId),
                    eq(table.identityType, "wallet")
                ),
        });
        return (walletNode?.identityValue as Address) ?? null;
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

    private async countTouchpoints(groupId: string): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(touchpointsTable)
            .where(eq(touchpointsTable.identityGroupId, groupId));
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

    private checkWalletPriority(
        weight1: GroupWeight,
        weight2: GroupWeight
    ): {
        anchorGroupId: string;
        mergingGroupId: string;
        anchorWallet: Address | null;
    } | null {
        if (weight1.hasWallet && weight2.hasWallet) {
            if (weight1.wallet !== weight2.wallet) {
                throw new Error(
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
        const comparisons: [number, number][] = [
            [weight1.assetsCount, weight2.assetsCount],
            [weight1.referralsCount, weight2.referralsCount],
            [weight1.interactionsCount, weight2.interactionsCount],
            [weight1.touchpointsCount, weight2.touchpointsCount],
        ];

        for (const [val1, val2] of comparisons) {
            if (val1 !== val2) {
                return val1 > val2 ? weight1 : weight2;
            }
        }

        return weight1;
    }
}
