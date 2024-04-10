import { Swiper } from "@/module/common/component/Swiper";
import { useCommunityTokens } from "@/module/community-token/hooks/useCommunityTokens";

export function SwiperNfts() {
    const { data } = useCommunityTokens();
    console.log("useCommunityTokens", data);

    const slides = [
        {
            name: "NFT 1",
            image: "https://via.placeholder.com/160x213",
            description: "Description 1",
        },
        {
            name: "NFT 2",
            image: "https://via.placeholder.com/160x213",
            description: "Description 2",
        },
        {
            name: "NFT 3",
            image: "https://via.placeholder.com/160x213",
            description: "Description 3",
        },
    ];
    return <Swiper slides={slides} />;
}
