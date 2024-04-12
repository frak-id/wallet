import { addresses } from "@/context/common/blockchain/addresses";
import { communityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { useInvalidateCommunityTokenAvailability } from "@/module/community-token/hooks/useIsCommunityTokenMintAvailable";
import { useMutation } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";

/**
 * Hook used to burn a community token
 * @param tokenAddress
 * @param id
 */
export function useBurnCommunityToken({
    id,
}: {
    id: bigint;
}) {
    // Get the write contract function
    const { writeContractAsync } = useWriteContract();
    const invalidateCommunityTokens = useInvalidateCommunityTokenAvailability();

    return useMutation({
        mutationKey: ["burn-community-token", id],
        mutationFn: async () => {
            const txHash = await writeContractAsync({
                address: addresses.communityToken,
                abi: communityTokenAbi,
                functionName: "burn",
                args: [id],
            });
            await invalidateCommunityTokens();
            return txHash;
        },
    });
}
