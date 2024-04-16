import { Slick } from "@/module/common/component/Slick";
import { useCommunityTokens } from "@/module/community-token/hooks/useCommunityTokens";

export function SliderNfts() {
    const { data: userTokens } = useCommunityTokens();

    // Early exit if no slides
    if (!userTokens || userTokens.length === 0) return null;

    // Otherwise, display the slides
    return <Slick slides={userTokens} />;
}
