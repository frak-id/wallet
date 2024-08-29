import { viemClient } from "@/context/blockchain/provider";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { contentRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useQuery } from "@tanstack/react-query";
import { readContract } from "viem/actions";

/**
 * Hook to check if the current user is the owner of the product
 * @param productId
 */
export function useIsProductOwner({ productId }: { productId: bigint }) {
    const { data: walletStatus } = useWalletStatus();

    return useQuery({
        queryKey: ["product", "owner", productId.toString()],
        enabled: walletStatus?.key === "connected" && !!productId,
        queryFn: async () => {
            if (walletStatus?.key !== "connected") {
                return false;
            }

            return readContract(viemClient, {
                abi: contentRegistryAbi,
                address: addresses.contentRegistry,
                functionName: "isAuthorized",
                args: [productId, walletStatus.wallet],
            });
        },
    });
}
