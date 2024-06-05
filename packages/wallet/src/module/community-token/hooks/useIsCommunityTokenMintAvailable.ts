import { isCommunityTokenForContentEnabled } from "@/context/community-token/action/getCommunityToken";
import { isCommunityTokenEnabledForWallet } from "@/context/community-token/action/getCommunityTokensForWallet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAccount } from "wagmi";

/**
 * Hook used to fetch community token for a content
 */
export function useIsCommunityTokenMintAvailable({
    contentId,
}: { contentId: bigint }) {
    const { address } = useAccount();

    return useQuery({
        queryKey: [
            "community-token",
            "is-mint-available",
            contentId,
            address ?? "no-address",
        ],
        queryFn: async () => {
            if (Number.isNaN(contentId) || !address) {
                return false;
            }
            // Check if that's enabled for the content
            const isEnabled = await isCommunityTokenForContentEnabled({
                contentId,
            });
            if (!isEnabled) {
                return false;
            }

            // Check if that's enabled for the wallet
            return isCommunityTokenEnabledForWallet({
                contentId,
                wallet: address,
            });
        },
        enabled: !!address,
        placeholderData: false,
    });
}

export function useInvalidateCommunityTokenAvailability() {
    const queryClient = useQueryClient();

    return useCallback(
        async () =>
            queryClient.invalidateQueries({
                queryKey: ["community-token"],
                exact: false,
            }),
        [queryClient]
    );
}
