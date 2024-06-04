import { communityTokenAbi } from "@/context/blockchain/abis/frak-gating-abis";
import { addresses } from "@/context/common/blockchain/addresses";
import { useInvalidateCommunityTokenAvailability } from "@/module/community-token/hooks/useIsCommunityTokenMintAvailable";
import { useMutation } from "@tanstack/react-query";
import { useAccount, useWriteContract } from "wagmi";

/**
 * Hook used to mint a new community token
 */
export function useMintCommunityToken({
    contentId,
}: {
    contentId?: number;
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
                args: [address, BigInt(contentId)],
            });

            // Invalidate the community token availability
            await invalidateCommunityTokens();

            return txHash;
        },
    });
}
