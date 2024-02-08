import { getArticlePricesForUser } from "@/context/paywall/action/getPrices";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useAccount } from "wagmi";

/**
 * Hook used to fetch and handle the prices
 */
export function useArticlePrices({
    contentId,
    articleId,
}: { contentId: Hex; articleId: Hex }) {
    /**
     * The current wallet address, can be undefined if not logged in
     *  Using the address here since the paywall isn't after the auth gate, to handle every possible redirection scenario
     */
    const { address } = useAccount();

    /**
     * Fetch the prices
     */
    const { data: prices, isPending: isFetchingPrices } = useQuery({
        queryKey: ["getArticlePricesForUser", contentId, articleId, address],
        queryFn: async () => {
            if (!contentId) {
                return [];
            }
            // Get the prices
            return getArticlePricesForUser({ contentId, articleId, address });
        },
        enabled: !!contentId,
    });

    return {
        prices,
        isFetchingPrices,
    };
}
