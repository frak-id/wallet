import { getCommunityTokensForWallet } from "@/context/community-token/action/getCommunityTokensForWallet";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook used to list all the current user community tokens
 */
export function useCommunityTokens() {
    const { smartWallet } = useWallet();

    return useQuery({
        queryKey: [
            "community-token",
            "get-all",
            smartWallet?.address ?? "no-address",
        ],
        queryFn: async () => {
            if (!smartWallet?.address) {
                return [];
            }
            return getCommunityTokensForWallet({ wallet: smartWallet.address });
        },
        placeholderData: [],
    });
}
