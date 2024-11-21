import { groupByDay } from "@/context/history/utils/groupByDay";
import type { HistoryGroup } from "@/types/HistoryGroup";
import type { InteractionHistory } from "@/types/InteractionHistory";
import { indexerApi } from "@frak-labs/shared/context/server";
import type { Address, Hex } from "viem";

type ApiResult = Array<
    {
        timestamp: string;
        productId: string;
        productName: string;
    } & (
        | {
              type: "OPEN_ARTICLE" | "READ_ARTICLE";
              data: {
                  articleId: string;
              };
          }
        | {
              type: "REFERRED";
              data: {
                  referrer: Address;
              };
          }
        | {
              type: "CREATE_REFERRAL_LINK" | "WEBSHOP_OPENNED";
              data: null;
          }
        | {
              type: "PURCHASE_STARTED" | "PURCHASE_COMPLETED";
              data: {
                  purchaseId: Hex;
              };
          }
    )
>;

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
        .json<ApiResult>();

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
