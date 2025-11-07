import type { GetInteractionsResponseDto } from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/client/server";
import type {
    HistoryGroup,
    InteractionHistory,
} from "@frak-labs/wallet-shared";
import type { Address } from "viem";
import { groupByDay } from "@/module/history/utils/groupByDay";

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
