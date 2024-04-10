import { getNftMetadata } from "@/context/community-token/action/getMetadata";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

/**
 * Hook used to get the metadata for the given community token
 */
export function useCommunityTokenMetadata({
    tokenAddress,
    id,
}: { tokenAddress: Address; id: bigint }) {
    return useQuery({
        queryKey: ["get-community-token-metadata", tokenAddress, id.toString()],
        queryFn: async () => getNftMetadata({ tokenId: id, tokenAddress }),
    });
}
