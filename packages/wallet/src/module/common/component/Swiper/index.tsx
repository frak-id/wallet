"use client";

import "swiper/css";
import { A11y } from "swiper/modules";
import { Swiper as SwiperComponent, SwiperSlide } from "swiper/react";
import styles from "./index.module.css";

type NftMetadata = {
    name: string;
    image: string;
    description: string;
};

export function Swiper({ slides = [] }: { slides: NftMetadata[] }) {
    return (
        <SwiperComponent
            freeMode={true}
            modules={[A11y]}
            spaceBetween={10}
            slidesPerView={2}
            className={styles.swiper}
        >
            {slides.map((slide, index) => (
                <SwiperSlide key={`slide-${index + 1}`}>
                    <img
                        src={slide.image}
                        alt={slide.name}
                        width={160}
                        height={213}
                    />
                </SwiperSlide>
            ))}
        </SwiperComponent>
    );
}
