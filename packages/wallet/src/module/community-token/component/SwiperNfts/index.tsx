import { Swiper } from "@/module/common/component/Swiper";
import { useCommunityTokens } from "@/module/community-token/hooks/useCommunityTokens";

export function SwiperNfts() {
    const { data: userTokens } = useCommunityTokens();

    return <Swiper slides={userTokens ?? []} />;
}
