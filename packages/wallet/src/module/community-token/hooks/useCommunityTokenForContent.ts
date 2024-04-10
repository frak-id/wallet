import { getCommunityTokenForContent } from "@/context/community-token/action/getCommunityToken";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook used to fetch community token for a content
 */
export function useCommunityTokenForContent({
    contentId,
}: { contentId: number }) {
    return useQuery({
        queryKey: ["get-community-token-for-content", contentId],
        queryFn: async () => {
            if (Number.isNaN(contentId)) {
                return;
            }
            return getCommunityTokenForContent({ contentId });
        },
    });
}
