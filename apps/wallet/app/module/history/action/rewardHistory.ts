import type { GetRewardHistoryResponseDto } from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/client/server";
import { type Address, formatUnits, isAddressEqual } from "viem";
import { groupByDay } from "@/module/history/utils/groupByDay";
import type { HistoryGroup } from "@/types/HistoryGroup";
import type { RewardHistory } from "@/types/RewardHistory";

/**
 * Get the reward history for a user
 * @param account
 */
export async function getRewardHistory({
    account,
}: {
    account: Address;
}): Promise<HistoryGroup<RewardHistory>> {
    // Perform the request to our api
    const rewardsHistory = await indexerApi
        .get(`rewards/${account}/history`)
        .json<GetRewardHistoryResponseDto>();

    // Merge both array into one
    const finalArray = [
        ...(rewardsHistory?.added?.map((item) => {
            const token = rewardsHistory.tokens.find((token) =>
                isAddressEqual(token.address, item.token)
            );
            return {
                type: "add",
                amount: Number.parseFloat(
                    formatUnits(BigInt(item.amount), token?.decimals ?? 18)
                ),
                timestamp: Number.parseInt(item.timestamp, 10),
                txHash: item.txHash,
                productId: item.productId,
                productName: item.productName,
            } as const;
        }) ?? []),
        ...(rewardsHistory?.claimed?.map((item) => {
            const token = rewardsHistory.tokens.find((token) =>
                isAddressEqual(token.address, item.token)
            );
            return {
                type: "claim",
                amount: Number.parseFloat(
                    formatUnits(BigInt(item.amount), token?.decimals ?? 18)
                ),
                timestamp: Number.parseInt(item.timestamp, 10),
                txHash: item.txHash,
                productId: item.productId,
                productName: item.productName,
            } as const;
        }) ?? []),
    ];

    // Group everything by date and return it
    return groupByDay(finalArray);
}
