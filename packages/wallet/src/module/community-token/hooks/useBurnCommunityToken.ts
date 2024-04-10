import { contentCommunityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { useMutation } from "@tanstack/react-query";
import type { Address } from "viem";
import { useWriteContract } from "wagmi";

/**
 * Hook used to burn a new community token
 * @param tokenAddress
 * @param id
 */
export function useBurnCommunityToken({
    tokenAddress,
    id,
}: {
    tokenAddress: Address;
    id: bigint;
}) {
    // Get the write contract function
    const { writeContractAsync } = useWriteContract();

    return useMutation({
        mutationKey: ["burn-community-token", tokenAddress, id],
        mutationFn: async () => {
            return await writeContractAsync({
                address: tokenAddress,
                abi: contentCommunityTokenAbi,
                functionName: "burn",
                args: [id],
            });
        },
    });
}
