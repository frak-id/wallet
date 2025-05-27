import { viemClient } from "@/context/blockchain/provider";
import {
    addresses,
    productInteractionManagerAbi,
} from "@frak-labs/app-essentials";
import { useQuery } from "@tanstack/react-query";
import { tryit } from "radash";
import type { Hex } from "viem";
import { readContract } from "viem/actions";

export function useProductInteractionContract({
    productId,
}: { productId: Hex }) {
    return useQuery({
        enabled: !!productId,
        queryKey: ["product", "interaction-contract", productId],
        queryFn: async () => {
            // Fetch the on chain interaction contract
            const [, interactionContract] = await tryit(() =>
                readContract(viemClient, {
                    abi: productInteractionManagerAbi,
                    functionName: "getInteractionContract",
                    address: addresses.productInteractionManager,
                    args: [BigInt(productId)],
                })
            )();

            return {
                interactionContract,
            };
        },
    });
}
