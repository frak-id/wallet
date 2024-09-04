import { viemClient } from "@/context/blockchain/provider";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { productRegistryAbi } from "@frak-labs/shared/context/blockchain/abis/frak-registry-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { useQuery } from "@tanstack/react-query";
import { type Hex, isAddressEqual } from "viem";
import { readContract } from "viem/actions";

/**
 * Hook to check if the current user is the owner of the product
 * @param productId
 */
export function useIsProductOwner({ productId }: { productId: Hex }) {
    const { data: walletStatus } = useWalletStatus();

    return useQuery({
        queryKey: ["product", "owner", productId.toString()],
        enabled: walletStatus?.key === "connected" && !!productId,
        queryFn: async () => {
            if (walletStatus?.key !== "connected") {
                return false;
            }

            const owner = await readContract(viemClient, {
                abi: productRegistryAbi,
                address: addresses.productRegistry,
                functionName: "ownerOf",
                args: [BigInt(productId)],
            });
            return isAddressEqual(owner, walletStatus.wallet);
        },
    });
}
