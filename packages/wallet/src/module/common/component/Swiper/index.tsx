"use client";

import { useCommunityTokenMetadata } from "@/module/community-token/hooks/useCommunityTokenMetadata";
import type { CommunityTokenBalance } from "@/types/CommunityTokenBalances";
import { useMemo } from "react";
import "swiper/css";
import { A11y } from "swiper/modules";
import { Swiper as SwiperComponent, SwiperSlide } from "swiper/react";
import styles from "./index.module.css";

export function Swiper({ slides = [] }: { slides: CommunityTokenBalance[] }) {
    return (
        <SwiperComponent
            freeMode={true}
            modules={[A11y]}
            spaceBetween={10}
            slidesPerView={2}
            className={styles.swiper}
        >
            {slides.map((slide, index) => (
                <NftSlide nft={slide} index={index} />
            ))}
        </SwiperComponent>
    );
}

function NftSlide({
    nft,
    index,
}: { nft: CommunityTokenBalance; index: number }) {
    const { data: metadata } = useCommunityTokenMetadata({
        tokenAddress: nft.contractAddress,
        id: nft.tokenId,
    });
    const imageUrl = useMemo(
        () => metadata?.image ?? "https://via.placeholder.com/160x213",
        [metadata?.image]
    );

    return (
        <SwiperSlide key={`slide-${index}`}>
            <img
                src={imageUrl}
                alt={metadata?.name ?? "NFT"}
                width={160}
                height={213}
            />
        </SwiperSlide>
    );
}
