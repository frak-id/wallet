import { contentCommunityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMutation } from "@tanstack/react-query";
import type { Address } from "viem";
import { useWriteContract } from "wagmi";

/**
 * Hook used to mint a new community token
 * @param tokenAddress
 */
export function useMintCommunityToken({
    tokenAddress,
}: {
    tokenAddress: Address;
}) {
    // Get the write contract function
    const { writeContractAsync } = useWriteContract();

    const { smartWallet } = useWallet();

    return useMutation({
        mutationKey: [
            "mint-community-token",
            tokenAddress,
            smartWallet?.address ?? "no-address",
        ],
        mutationFn: async () => {
            if (!smartWallet?.address) {
                throw new Error("No smart wallet address found");
            }

            return await writeContractAsync({
                address: tokenAddress,
                abi: contentCommunityTokenAbi,
                functionName: "mint",
                args: [smartWallet.address],
            });
        },
    });
}
