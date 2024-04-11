import { addresses } from "@/context/common/blockchain/addresses";
import { communityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { isCommunityTokenForContentEnabled } from "@/context/community-token/action/getCommunityToken";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { readContract } from "viem/actions";
import { arbitrumSepolia } from "viem/chains";
import { useClient } from "wagmi";

/**
 * Hook used to fetch community token for a content
 */
export function useIsCommunityTokenMintAvailable({
    contentId,
}: { contentId: number }) {
    const { smartWallet } = useWallet();
    const viemClient = useClient({ chainId: arbitrumSepolia.id });

    return useQuery({
        queryKey: [
            "community-token",
            "is-mint-available",
            contentId,
            smartWallet?.address ?? "no-address",
            viemClient?.uid ?? "no-client",
        ],
        queryFn: async () => {
            if (
                Number.isNaN(contentId) ||
                !smartWallet?.address ||
                !viemClient
            ) {
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
            const communityTokenBalance = await readContract(viemClient, {
                address: addresses.communityToken,
                abi: communityTokenAbi,
                functionName: "balanceOf",
                args: [smartWallet.address, BigInt(contentId)],
            });
            return communityTokenBalance === 0n;
        },
        enabled: !!smartWallet?.address && !!viemClient,
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
