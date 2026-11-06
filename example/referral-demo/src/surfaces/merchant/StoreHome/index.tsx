import { useRef } from "react";
import { ProductArt, SceneArt } from "@/art";
import { useDemoNav } from "@/core/store";
import { catalog, heroProductId, products } from "@/data/merchant";
import { useLang } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import type { StoreHomeProps } from "@/surfaces/contracts";
import {
    leaBagBeforeHero,
    useFormatNumber,
    useMerchantT,
} from "../components/format";
import { StarIcon } from "../components/icons";
import * as page from "../components/page.css";
import { Rating } from "../components/Rating";
import { StoreHeader } from "../components/StoreHeader";
import * as styles from "./storeHome.css";

const totalReviews = catalog.reduce((sum, id) => sum + products[id].reviews, 0);
const averageRating =
    Math.round(
        (catalog.reduce(
            (sum, id) => sum + products[id].rating * products[id].reviews,
            0
        ) /
            totalReviews) *
            10
    ) / 10;

function BestSellers() {
    const lang = useLang();
    const money = useFormatMoney();
    const { next } = useDemoNav();

    return (
        <div className={styles.rail}>
            {catalog.map((id) => {
                const product = products[id];
                const isHero = id === heroProductId;
                return (
                    <button
                        key={id}
                        type="button"
                        className={styles.card}
                        onClick={isHero ? next : undefined}
                    >
                        <span
                            className={
                                isHero
                                    ? `${styles.cardImage} ${page.hint}`
                                    : styles.cardImage
                            }
                        >
                            <ProductArt productId={id} variant="packshot" />
                            {product.badge && (
                                <span className={styles.cardBadge}>
                                    {product.badge[lang]}
                                </span>
                            )}
                        </span>
                        <span className={styles.cardName}>
                            {product.name[lang]}
                        </span>
                        <span className={styles.cardClaim}>
                            {product.claim[lang]}
                        </span>
                        <Rating
                            rating={product.rating}
                            reviews={product.reviews}
                            size={10}
                            compact
                        />
                        <span className={styles.cardPrice}>
                            {money(product.price)}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export function StoreHome(_props: StoreHomeProps) {
    const t = useMerchantT();
    const number = useFormatNumber();
    const scrollRef = useRef<HTMLDivElement>(null);
    const bestSellersRef = useRef<HTMLElement>(null);

    const revealBestSellers = () => {
        const scroller = scrollRef.current;
        const section = bestSellersRef.current;
        if (!scroller || !section) return;
        scroller.scrollTo({ top: section.offsetTop - 60, behavior: "smooth" });
    };

    return (
        <div className={page.screen}>
            <div ref={scrollRef} className={page.scroll}>
                <StoreHeader bagCount={leaBagBeforeHero} withNav />

                <section className={styles.hero}>
                    <div className={styles.heroMedia}>
                        <SceneArt
                            scene="storeHero"
                            className={styles.heroArt}
                        />
                    </div>
                    <div className={styles.heroText}>
                        <span className={styles.heroEyebrow}>
                            {t("home.heroEyebrow")}
                        </span>
                        <h1 className={styles.heroTitle}>
                            {t("home.heroTitle")}
                        </h1>
                        <button
                            type="button"
                            className={styles.heroCta}
                            onClick={revealBestSellers}
                        >
                            {t("home.heroCta")}
                        </button>
                    </div>
                </section>

                <section ref={bestSellersRef} className={styles.section}>
                    <div className={styles.sectionHead}>
                        <h2 className={styles.sectionTitle}>
                            {t("home.bestSellers")}
                        </h2>
                        <span className={page.linkButton}>
                            {t("home.viewAll")}
                        </span>
                    </div>
                    <BestSellers />
                </section>

                <section className={styles.story}>
                    <span className={page.eyebrow}>
                        {t("home.storyEyebrow")}
                    </span>
                    <h2 className={styles.storyTitle}>
                        {t("home.storyTitle")}
                    </h2>
                    <p className={styles.storyBody}>{t("home.storyBody")}</p>
                    <span className={page.linkButton}>
                        {t("home.storyLink")}
                    </span>
                </section>

                <section className={styles.reviews}>
                    <div className={styles.score}>
                        <span className={styles.scoreValue}>
                            {t("home.reviewsScore", {
                                rating: number(averageRating),
                            })}
                        </span>
                        <span className={styles.scoreStars}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <StarIcon key={star} size={14} />
                            ))}
                        </span>
                    </div>
                    <span className={page.muted}>
                        {t("home.reviewsCount", {
                            count: number(Math.floor(totalReviews / 100) * 100),
                        })}
                    </span>
                    <p className={styles.quote}>{t("home.reviewQuote")}</p>
                    <span className={styles.author}>
                        {t("home.reviewAuthor")}
                    </span>
                </section>

                <footer className={styles.footer}>{t("home.footer")}</footer>
            </div>
        </div>
    );
}
