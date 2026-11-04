import { AnimatePresence, motion } from "motion/react";
import { type UIEvent, useEffect, useState } from "react";
import { ProductArt } from "@/art";
import { useDemoNav } from "@/core/store";
import { merchant, type ProductId, products } from "@/data/merchant";
import { useLang } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import type { ProductPageProps } from "@/surfaces/contracts";
import { Accordion } from "../components/Accordion";
import { ApplePayButton } from "../components/ApplePayButton";
import { FrakReferralBanner } from "../components/FrakReferralBanner";
import { leaBagBeforeHero, useMerchantT } from "../components/format";
import {
    CheckIcon,
    LeafIcon,
    ReturnIcon,
    TruckIcon,
} from "../components/icons";
import * as page from "../components/page.css";
import { Rating } from "../components/Rating";
import { StoreHeader } from "../components/StoreHeader";
import * as styles from "./productPage.css";

const SLIDES = ["packshot", "cutout", "texture"] as const;

/** What the real store spends talking to its cart API. */
const ADD_TO_CART_MS = 600;

const sheetSpring = { type: "spring", stiffness: 380, damping: 36 } as const;

function Gallery({ productId }: { productId: ProductId }) {
    const [active, setActive] = useState(0);

    const onScroll = (event: UIEvent<HTMLDivElement>) => {
        const { scrollLeft, clientWidth } = event.currentTarget;
        setActive(Math.round(scrollLeft / Math.max(clientWidth, 1)));
    };

    return (
        <div className={styles.gallery}>
            <div className={styles.slides} onScroll={onScroll}>
                {SLIDES.map((tone) => (
                    <div key={tone} className={styles.slide}>
                        <div className={styles.slideTint({ tone })}>
                            {tone === "texture" ? (
                                <span className={styles.drop} />
                            ) : (
                                <ProductArt
                                    productId={productId}
                                    variant={tone}
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className={styles.dots}>
                {SLIDES.map((tone, index) => (
                    <span
                        key={tone}
                        className={styles.dot({ active: index === active })}
                    />
                ))}
            </div>
        </div>
    );
}

function AddedDrawer({
    productId,
    bagCount,
    onViewCart,
}: {
    productId: ProductId;
    bagCount: number;
    onViewCart: () => void;
}) {
    const t = useMerchantT();
    const lang = useLang();
    const money = useFormatMoney();
    const product = products[productId];

    return (
        <>
            <motion.div
                className={styles.backdrop}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
            />
            <motion.div
                className={styles.drawer}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={sheetSpring}
            >
                <div className={styles.drawerHead}>
                    <span className={styles.drawerCheck}>
                        <CheckIcon size={14} strokeWidth={2.4} />
                    </span>
                    {t("product.added")}
                </div>
                <div className={styles.drawerLine}>
                    <span className={styles.drawerThumb}>
                        <ProductArt productId={productId} variant="cutout" />
                    </span>
                    <span className={styles.drawerText}>
                        <span className={styles.drawerName}>
                            {product.name[lang]}
                        </span>
                        <span className={page.muted}>{product.size}</span>
                    </span>
                    <span>{money(product.price)}</span>
                </div>
                <div className={styles.drawerActions}>
                    <button
                        type="button"
                        className={page.storeButton({ tone: "ink" })}
                        onClick={onViewCart}
                    >
                        {t("product.viewCart", { count: bagCount })}
                    </button>
                    <span className={page.linkButton}>
                        {t("product.keepShopping")}
                    </span>
                </div>
            </motion.div>
        </>
    );
}

export function ProductPage({ productId, referred, mode }: ProductPageProps) {
    const t = useMerchantT();
    const lang = useLang();
    const money = useFormatMoney();
    const { next } = useDemoNav();
    const product = products[productId];
    const [cart, setCart] = useState<"idle" | "adding" | "added">("idle");

    useEffect(() => {
        if (cart !== "adding") return;
        const timer = setTimeout(() => setCart("added"), ADD_TO_CART_MS);
        return () => clearTimeout(timer);
    }, [cart]);

    const bagCount =
        (referred ? 0 : leaBagBeforeHero) + (cart === "added" ? 1 : 0);
    const freeFrom = money(merchant.freeShippingFrom, "reward");

    return (
        <div className={page.screen}>
            <div className={page.scroll}>
                <StoreHeader bagCount={bagCount} />
                {referred && <FrakReferralBanner />}
                <Gallery productId={productId} />

                <div className={styles.info}>
                    <h1 className={styles.name}>{product.name[lang]}</h1>
                    <p className={styles.claim}>{product.claim[lang]}</p>
                    <Rating rating={product.rating} reviews={product.reviews} />
                    <div className={styles.priceRow}>
                        <span className={styles.price}>
                            {money(product.price)}
                        </span>
                        <span className={styles.taxes}>
                            {t("product.taxes")}
                        </span>
                    </div>
                    <div className={styles.option}>
                        <span className={styles.optionLabel}>
                            {t("product.size")}
                        </span>
                        <span className={styles.chip}>{product.size}</span>
                    </div>
                    <p className={styles.description}>
                        {product.description[lang]}
                    </p>
                    <div className={styles.perks}>
                        <span className={styles.perk}>
                            <TruckIcon size={20} />
                            {t("product.perk.shipping", { amount: freeFrom })}
                        </span>
                        <span className={styles.perk}>
                            <ReturnIcon size={20} />
                            {t("product.perk.returns")}
                        </span>
                        <span className={styles.perk}>
                            <LeafIcon size={20} />
                            {t("product.perk.made")}
                        </span>
                    </div>
                </div>

                <div className={styles.accordions}>
                    <Accordion title={t("product.ingredients")}>
                        {t("product.ingredientsBody")}
                    </Accordion>
                    <Accordion title={t("product.usage")}>
                        {t("product.usageBody")}
                    </Accordion>
                </div>
            </div>

            <div className={page.bottomBar}>
                {mode === "express" ? (
                    <ApplePayButton
                        label="buy"
                        className={page.hint}
                        onClick={next}
                    />
                ) : (
                    <button
                        type="button"
                        className={`${page.storeButton({ tone: "ink" })} ${page.hint}`}
                        onClick={() => cart === "idle" && setCart("adding")}
                    >
                        {cart === "adding" ? (
                            <span className={page.spinner} />
                        ) : (
                            t("product.addToCart", {
                                price: money(product.price),
                            })
                        )}
                    </button>
                )}
            </div>

            <AnimatePresence>
                {cart === "added" && (
                    <AddedDrawer
                        productId={productId}
                        bagCount={bagCount}
                        onViewCart={next}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
