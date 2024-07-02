"use client";

import { useInvalidateCommunityTokenAvailability } from "@/module/community-token/hooks/useIsCommunityTokenMintAvailable";
import { communityTokenAbi } from "@frak-labs/shared/context/blockchain/abis/frak-gating-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
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
