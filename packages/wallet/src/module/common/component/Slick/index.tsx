"use client";

import { ModalBurn } from "@/module/community-token/component/ModalBurn";
import { useBurnCommunityToken } from "@/module/community-token/hooks/useBurnCommunityToken";
import { useCommunityTokenMetadata } from "@/module/community-token/hooks/useCommunityTokenMetadata";
import type { CommunityTokenBalance } from "@/types/CommunityTokenBalances";
import { useEffect, useMemo, useState } from "react";
import Slider from "react-slick";
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
    const {
        mutate: burnCommunityToken,
        isPending,
        isSuccess,
    } = useBurnCommunityToken({
        id: nft.tokenId,
    });
    const { data: metadata } = useCommunityTokenMetadata({
        id: nft.tokenId,
    });
    const imageUrl = useMemo(
        () => metadata?.image ?? "https://via.placeholder.com/160x213",
        [metadata?.image]
    );
    const [openModal, setOpenModal] = useState(false);

    /**
     * Close the modal when the burn is successful
     */
    useEffect(() => {
        if (!isSuccess) return;
        setOpenModal(false);
    }, [isSuccess]);

    return (
        <div className={styles.slick__item}>
            <img
                src={imageUrl}
                alt={metadata?.name ?? "NFT"}
                width={160}
                height={213}
            />
            <ModalBurn
                burnCommunityToken={burnCommunityToken}
                openModal={openModal}
                setOpenModal={setOpenModal}
                isLoading={isPending}
                className={styles.slick__burn}
            />
        </div>
    );
}
