"use client";

import { useInvalidateCommunityTokenAvailability } from "@/module/community-token/hooks/useIsCommunityTokenMintAvailable";
import { communityTokenAbi } from "@frak-labs/shared/context/blockchain/abis/frak-gating-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useMutation } from "@tanstack/react-query";
import { useAccount, useWriteContract } from "wagmi";

/**
 * Hook used to mint a new community token
 */
export function useMintCommunityToken({
    contentId,
}: {
    contentId?: bigint;
}) {
    // Get the write contract function
    const { writeContractAsync } = useWriteContract();

    const { address } = useAccount();

    const invalidateCommunityTokens = useInvalidateCommunityTokenAvailability();

    return useMutation({
        mutationKey: [
            "mint-community-token",
            contentId ?? "no-content-id",
            address ?? "no-address",
        ],
        mutationFn: async () => {
            if (!address) {
                throw new Error("No smart wallet address found");
            }
            if (contentId === undefined) {
                throw new Error("No content id found");
            }

            const txHash = await writeContractAsync({
                address: addresses.communityToken,
                abi: communityTokenAbi,
                functionName: "mint",
                args: [address, contentId],
            });

            // Invalidate the community token availability
            await invalidateCommunityTokens();

            return txHash;
        },
    });
}
