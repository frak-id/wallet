import type { LightNews } from "@/types/News";
import {
    Swiper as SwiperCmp,
    SwiperSlide as SwiperSlideCmp,
} from "swiper/react";
import styles from "./index.module.css";
import "swiper/css";
import { ItemSwiper } from "@/module/news/component/List";

export function Swiper({ featured }: { featured: LightNews[] }) {
    return (
        <div className={styles.swiper}>
            <SwiperCmp slidesPerView={"auto"} spaceBetween={15}>
                {featured?.map((news) => (
                    <SwiperSlideCmp
                        key={news.id}
                        className={styles.swiper__slide}
                    >
                        <ItemSwiper news={news} />
                    </SwiperSlideCmp>
                ))}
            </SwiperCmp>
        </div>
    );
}
