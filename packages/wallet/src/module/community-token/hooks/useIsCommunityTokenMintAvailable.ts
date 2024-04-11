import { isCommunityTokenEnabledForWallet } from "@/context/community-token/action/getCommunityToken";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook used to fetch community token for a content
 */
export function useIsCommunityTokenMintAvailable({
    contentId,
}: { contentId: number }) {
    const { smartWallet } = useWallet();

    return useQuery({
        queryKey: [
            "is-community-token-mint-available",
            contentId,
            smartWallet?.address ?? "no-address",
        ],
        queryFn: async () => {
            if (Number.isNaN(contentId) || !smartWallet?.address) {
                return false;
            }
            return isCommunityTokenEnabledForWallet({
                contentId,
                wallet: smartWallet.address,
            });
        },
        placeholderData: false,
    });
}
