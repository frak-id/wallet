"use client";

import { useCommunityTokenMetadata } from "@/module/community-token/hooks/useCommunityTokenMetadata";
import type { CommunityTokenBalance } from "@/types/CommunityTokenBalances";
import { useMemo } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import styles from "./index.module.css";

export function Slick({ slides = [] }: { slides: CommunityTokenBalance[] }) {
    const settings = {
        infinite: false,
        slidesToShow: 2,
        slidesToScroll: 2,
        variableWidth: true,
        arrows: false,
        className: styles.slick,
    };
    return (
        <Slider {...settings}>
            {slides.map((slide, index) => (
                <NftSlide nft={slide} key={`slide-${index}-${slide.tokenId}`} />
            ))}
        </Slider>
    );
}

function NftSlide({ nft }: { nft: CommunityTokenBalance }) {
    const { data: metadata } = useCommunityTokenMetadata({
        id: nft.tokenId,
    });
    const imageUrl = useMemo(
        () => metadata?.image ?? "https://via.placeholder.com/160x213",
        [metadata?.image]
    );

    return (
        <img
            className={styles.slick__item}
            src={imageUrl}
            alt={metadata?.name ?? "NFT"}
            width={160}
            height={213}
        />
    );
}
