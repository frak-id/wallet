import { groupByDay } from "@/module/history/utils/groupByDay";
import type { HistoryGroup } from "@/types/HistoryGroup";
import type { InteractionHistory } from "@/types/InteractionHistory";
import type { GetInteractionsResponseDto } from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/shared/context/server";
import type { Address } from "viem";

/**
 * Get the reward history for a user
 * @param account
 */
export async function getInteractionHistory({
    account,
}: {
    account: Address;
}): Promise<HistoryGroup<InteractionHistory>> {
    // Perform the request to our api
    const interactionsHistory = await indexerApi
        .get(`interactions/${account}`)
        .json<GetInteractionsResponseDto>();

    // Map our result
    const finalArray = interactionsHistory?.map((item) => {
        return {
            ...item,
            timestamp: Number(item.timestamp),
        };
    });

    // Return the grouped by date version
    return groupByDay(finalArray ?? []);
}
