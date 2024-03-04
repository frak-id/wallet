import { getUnlockStatusOnArticle } from "@/context/paywall/action/getStatus";
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex } from "viem";

/**
 * Hook to query the on chain article unlock status
 * @param parameters
 */
export const useOnChainArticleUnlockStatus = ({
    contentId,
    articleId,
    address,
}: { contentId?: Hex; articleId?: Hex; address?: Address }) =>
    useQuery({
        queryKey: [
            "onChainArticleUnlockStatus",
            contentId ?? "no-content",
            articleId ?? "no-article",
            address ?? "no-wallet",
        ],
        queryFn: async () => {
            if (!(contentId && articleId && address)) {
                return;
            }
            return getUnlockStatusOnArticle({
                contentId,
                articleId,
                user: address,
            });
        },
        enabled: !!contentId && !!articleId && !address,
    });
