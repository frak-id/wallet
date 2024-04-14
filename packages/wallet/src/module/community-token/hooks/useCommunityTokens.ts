import { getCommunityTokensForWallet } from "@/context/community-token/action/getCommunityTokensForWallet";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

/**
 * Hook used to list all the current user community tokens
 */
export function useCommunityTokens() {
    const { address } = useAccount();

    return useQuery({
        queryKey: ["community-token", "get-all", address ?? "no-address"],
        queryFn: async () => {
            if (!address) {
                return [];
            }
            return getCommunityTokensForWallet({ wallet: address });
        },
        placeholderData: [],
    });
}
