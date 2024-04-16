"use client";

import { Title } from "@/module/common/component/Title";
import { ModalBurn } from "@/module/community-token/component/ModalBurn";
import { useBurnCommunityToken } from "@/module/community-token/hooks/useBurnCommunityToken";
import { useCommunityTokenMetadata } from "@/module/community-token/hooks/useCommunityTokenMetadata";
import { userThemeAtom } from "@/module/settings/atoms/theme";
import type { CommunityTokenBalance } from "@/types/CommunityTokenBalances";
import { useAtomValue } from "jotai";
import { useEffect, useMemo, useState } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import styles from "./index.module.css";

export function Slick({ slides = [] }: { slides: CommunityTokenBalance[] }) {
    // Settings for the slider
    const settings = useMemo(
        () => ({
            infinite: false,
            slidesToShow: 2,
            slidesToScroll: 2,
            variableWidth: true,
            arrows: false,
            className: styles.slick,
        }),
        []
    );

    return (
        <>
            <Title>Presse 🗞</Title>
            <Slider {...settings}>
                {slides.map((slide, index) => (
                    <NftSlide
                        nft={slide}
                        key={`slide-${index}-${slide.tokenId}`}
                    />
                ))}
            </Slider>
        </>
    );
}

function NftSlide({ nft }: { nft: CommunityTokenBalance }) {
    const theme = useAtomValue(userThemeAtom);
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
        () => metadata?.images?.[theme] ?? metadata?.image,
        [metadata?.images, metadata?.image, theme]
    );
    const [openModal, setOpenModal] = useState(false);

    /**
     * Close the modal when the burn is successful
     */
    useEffect(() => {
        if (!isSuccess) return;
        setOpenModal(false);
    }, [isSuccess]);

    // If we don't have an image url yet, don't disply anything
    if (!imageUrl) return null;

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
