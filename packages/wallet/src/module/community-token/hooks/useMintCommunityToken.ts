import { addresses } from "@/context/common/blockchain/addresses";
import { communityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { useWallet } from "@/module/wallet/provider/WalletProvider";
import { useMutation } from "@tanstack/react-query";
import { useWriteContract } from "wagmi";

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

    const { smartWallet } = useWallet();

    return useMutation({
        mutationKey: [
            "mint-community-token",
            contentId ?? "no-content-id",
            smartWallet?.address ?? "no-address",
        ],
        mutationFn: async () => {
            if (!smartWallet?.address) {
                throw new Error("No smart wallet address found");
            }
            if (contentId === undefined) {
                throw new Error("No content id found");
            }

            return await writeContractAsync({
                address: addresses.communityToken,
                abi: communityTokenAbi,
                functionName: "mint",
                args: [smartWallet.address, BigInt(contentId)],
            });
        },
    });
}
