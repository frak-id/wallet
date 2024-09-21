"use server";
import type { InteractionHistory } from "@/types/InteractionHistory";
import ky from "ky";
import type { Address } from "viem";

type ApiResult = Array<
    {
        timestamp: string;
        productId: string;
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
              type: "CREATE_REFERRAL_LINK";
              data: null;
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
}): Promise<InteractionHistory[]> {
    // Perform the request to our api
    const interactionsHistory = await ky
        .get(`${process.env.INDEXER_URL}/interactions/${account}`)
        .json<ApiResult>();

    // Map our result
    return (
        interactionsHistory?.map((item) => {
            return {
                ...item,
                timestamp: Number(item.timestamp),
            };
        }) ?? []
    );
}
