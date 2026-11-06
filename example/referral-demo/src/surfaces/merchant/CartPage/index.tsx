import { motion } from "motion/react";
import { ProductArt } from "@/art";
import { useDemoNav } from "@/core/store";
import { merchant, orders, orderTotal, products } from "@/data/merchant";
import { useLang } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import type { CartPageProps } from "@/surfaces/contracts";
import { ApplePayButton } from "../components/ApplePayButton";
import { useMerchantT } from "../components/format";
import { CheckIcon, LockIcon, MinusIcon, PlusIcon } from "../components/icons";
import * as page from "../components/page.css";
import { StoreHeader } from "../components/StoreHeader";
import * as styles from "./cartPage.css";

export function CartPage({ persona }: CartPageProps) {
    const t = useMerchantT();
    const lang = useLang();
    const money = useFormatMoney();
    const { next } = useDemoNav();
    const order = orders[persona];
    const count = order.lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = orderTotal(order) - order.shipping;
    const progress = Math.min(1, subtotal / merchant.freeShippingFrom);

    return (
        <div className={page.screen}>
            <div className={page.scroll}>
                <StoreHeader bagCount={count} />
                <div className={styles.head}>
                    <h1 className={styles.title}>{t("cart.title")}</h1>
                    <span className={page.muted}>
                        {t("cart.items", { count })}
                    </span>
                </div>

                <div className={styles.shipping}>
                    <span className={styles.shippingText}>
                        <CheckIcon size={16} strokeWidth={2} />
                        {t("cart.freeShipping")}
                    </span>
                    <div className={styles.progressTrack}>
                        <motion.div
                            className={styles.progressFill}
                            initial={{ scaleX: 0.55 }}
                            animate={{ scaleX: progress }}
                            transition={{
                                delay: 0.35,
                                duration: 0.7,
                                ease: "easeOut",
                            }}
                        />
                    </div>
                </div>

                <div className={styles.lines}>
                    {order.lines.map((line) => {
                        const product = products[line.productId];
                        return (
                            <div key={line.productId} className={styles.line}>
                                <span className={styles.thumb}>
                                    <ProductArt
                                        productId={line.productId}
                                        variant="cutout"
                                    />
                                </span>
                                <div className={styles.lineBody}>
                                    <div className={styles.lineTop}>
                                        <span className={styles.lineName}>
                                            {product.name[lang]}
                                        </span>
                                        <span>
                                            {money(
                                                product.price * line.quantity
                                            )}
                                        </span>
                                    </div>
                                    <span className={styles.lineMeta}>
                                        {product.size}
                                    </span>
                                    <div className={styles.lineBottom}>
                                        <span className={styles.stepper}>
                                            <button
                                                type="button"
                                                className={styles.stepperButton}
                                                aria-label={t("cart.decrease")}
                                            >
                                                <MinusIcon size={14} />
                                            </button>
                                            <span
                                                className={styles.stepperValue}
                                            >
                                                {line.quantity}
                                            </span>
                                            <button
                                                type="button"
                                                className={styles.stepperButton}
                                                aria-label={t("cart.increase")}
                                            >
                                                <PlusIcon size={14} />
                                            </button>
                                        </span>
                                        <span className={styles.remove}>
                                            {t("cart.remove")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className={page.bottomBar}>
                <div className={styles.subtotal}>
                    <span>{t("cart.subtotal")}</span>
                    <span className={styles.subtotalValue}>
                        {money(subtotal)}
                    </span>
                </div>
                <p className={styles.note}>{t("cart.taxesNote")}</p>
                <button
                    type="button"
                    className={`${page.storeButton({ tone: "ink" })} ${page.hint}`}
                    onClick={next}
                >
                    <LockIcon size={15} strokeWidth={1.8} />
                    {t("cart.checkout")}
                </button>
                <ApplePayButton size="compact" onClick={next} />
            </div>
        </div>
    );
}
