import { getUnlockStatusOnArticle } from "@/context/paywall/action/getStatus";
import { sessionAtom } from "@/module/common/atoms/session";
import { jotaiStore } from "@module/atoms/store";
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
}: {
    contentId?: Hex;
    articleId?: Hex;
    address?: Address;
}) =>
    useQuery({
        queryKey: [
            "onChainArticleUnlockStatus",
            contentId ?? "no-content",
            articleId ?? "no-article",
            address ?? "no-wallet",
        ],
        queryFn: async () => {
            if (!(contentId && articleId)) {
                return null;
            }

            // Get the address from the jotai store if not provided
            const checkedAddress =
                address ?? jotaiStore.get(sessionAtom)?.wallet?.address;
            // If still not present, exit
            if (!checkedAddress) {
                return null;
            }

            return getUnlockStatusOnArticle({
                contentId,
                articleId,
                user: checkedAddress,
            });
        },
        enabled: !!contentId && !!articleId,
    });
