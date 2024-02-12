import { getArticlePricesForUser } from "@/context/paywall/action/getPrices";
import { useMutation } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useAccount } from "wagmi";

/**
 * Hook used to fetch and handle the prices
 */
export function useArticlePrices() {
    /**
     * The current wallet address, can be undefined if not logged in
     *  Using the address here since the paywall isn't after the auth gate, to handle every possible redirection scenario
     */
    const { address } = useAccount();

    /**
     * Fetch the prices
     */
    const {
        data: prices,
        isPending: isFetchingPrices,
        mutateAsync: fetchPrices,
    } = useMutation({
        mutationKey: ["getArticlePricesForUser", address],
        mutationFn: async ({
            contentId,
            articleId,
        }: { contentId?: Hex; articleId?: Hex }) => {
            if (!(contentId && articleId)) {
                return { prices: [] };
            }
            // Get the prices
            return {
                prices: await getArticlePricesForUser({
                    contentId,
                    articleId,
                    address: "0x3AAd376FbEf774bb6c3108F46112aa288f3091aa",
                }),
            };
        },
    });

    return {
        prices,
        isFetchingPrices,
        fetchPrices,
    };
}
