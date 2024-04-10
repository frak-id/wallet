import { contentCommunityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMutation } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { useWriteContract } from "wagmi";

/**
 * Hook used to mint a new community token
 */
export function useMintCommunityToken({
    tokenAddress,
}: {
    tokenAddress?: Address;
}) {
    // Get the write contract function
    const { writeContractAsync } = useWriteContract();

    const { smartWallet } = useWallet();

    return useMutation({
        mutationKey: [
            "mint-community-token",
            tokenAddress ?? "no-token-address",
            smartWallet?.address ?? "no-address",
        ],
        mutationFn: async ({ tokenAddress }: { tokenAddress: Hex }) => {
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
