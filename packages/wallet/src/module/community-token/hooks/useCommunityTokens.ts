import { getCommunityTokensForWallet } from "@/context/community-token/action/getCommunityToken";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook used to list all the current user community tokens
 */
export function useCommunityTokens() {
    const { smartWallet } = useWallet();

    return useQuery({
        queryKey: [
            "get-community-tokens",
            smartWallet?.address ?? "no-address",
        ],
        queryFn: async () => {
            if (!smartWallet?.address) {
                return [];
            }
            return getCommunityTokensForWallet({ wallet: smartWallet.address });
        },
    });
}
