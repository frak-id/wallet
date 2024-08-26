"use server";
import type { InteractionHistory } from "@/types/InteractionHistory";
import ky from "ky";
import { unstable_cache } from "next/cache";
import type { Address } from "viem";

type ApiResult = Array<
    {
        timestamp: string;
        contentId: string;
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
async function _getInteractionHistory({
    account,
}: {
    account: Address;
}): Promise<InteractionHistory[]> {
    // Perform the request to our api
    const interactionsHistory = await ky
        .get(`https://indexer.frak.id/interactions/${account}`)
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

/**
 * Cached version of the wallet history fetch
 */
export const getInteractionHistory = unstable_cache(
    _getInteractionHistory,
    ["history", "interaction"],
    {
        // Keep that in server cache for 2min
        revalidate: 2 * 60,
    }
);
