import { Slick } from "@/module/common/component/Slick";
import { useCommunityTokens } from "@/module/community-token/hooks/useCommunityTokens";

export function SliderNfts() {
    const { data: userTokens } = useCommunityTokens();
    return <Slick slides={userTokens ?? []} />;
}
