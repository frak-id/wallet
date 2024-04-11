import { getCommunityTokenMetadata } from "@/context/community-token/action/getMetadata";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook used to get the metadata for the given community token
 */
export function useCommunityTokenMetadata({ id }: { id: bigint }) {
    return useQuery({
        queryKey: ["get-community-token-metadata", id.toString()],
        queryFn: async () => getCommunityTokenMetadata({ tokenId: id }),
    });
}
