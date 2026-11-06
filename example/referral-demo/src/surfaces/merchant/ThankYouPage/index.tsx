import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useDemoNav } from "@/core/store";
import { orders, orderTotal } from "@/data/merchant";
import { fullName, personas } from "@/data/personas";
import { useFormatMoney } from "@/i18n/format";
import type { ThankYouPageProps } from "@/surfaces/contracts";
import * as checkout from "../components/checkout.css";
import { FrakPostPurchaseCard } from "../components/FrakPostPurchaseCard";
import { useMerchantT } from "../components/format";
import { CheckIcon } from "../components/icons";
import { OrderSummary } from "../components/OrderSummary";
import * as page from "../components/page.css";
import { CheckoutHeader } from "../components/StoreHeader";
import * as styles from "./thankYouPage.css";

const TOAST_MS = 2200;

const STEPS = [
    { label: "thankYou.step.confirmed", date: "thankYou.step.today" },
    { label: "thankYou.step.shipped", date: "thankYou.step.tomorrow" },
    { label: "thankYou.step.delivered", date: "thankYou.step.soon" },
] as const;

function SharedToast() {
    const t = useMerchantT();
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const timer = setTimeout(() => setVisible(false), TOAST_MS);
        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className={styles.toast}
                    initial={{ opacity: 0, y: 12, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, y: 8, x: "-50%" }}
                    transition={{ delay: 0.25, duration: 0.3 }}
                >
                    <span className={styles.toastIcon}>
                        <CheckIcon size={14} strokeWidth={2.6} />
                    </span>
                    {t("thankYou.sharedToast")}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export function ThankYouPage({ persona: personaId, card }: ThankYouPageProps) {
    const t = useMerchantT();
    const money = useFormatMoney();
    const { next } = useDemoNav();
    const persona = personas[personaId];
    const order = orders[personaId];

    return (
        <div className={`${page.screen} ${checkout.canvas}`}>
            <div className={page.scroll}>
                <CheckoutHeader />
                <div className={styles.main}>
                    <div className={styles.head}>
                        <span className={styles.headCheck}>
                            <CheckIcon size={24} strokeWidth={2} />
                        </span>
                        <span className={styles.headText}>
                            <span className={styles.orderNumber}>
                                {t("thankYou.orderNumber", {
                                    number: order.number,
                                })}
                            </span>
                            <h1 className={styles.thanks}>
                                {t("thankYou.thanks", {
                                    name: persona.firstName,
                                })}
                            </h1>
                        </span>
                    </div>

                    <FrakPostPurchaseCard state={card} onAction={next} />

                    <div className={checkout.box}>
                        <div className={styles.boxBody}>
                            <h2 className={styles.boxTitle}>
                                {t("thankYou.confirmedTitle")}
                            </h2>
                            <p className={styles.boxText}>
                                {t("thankYou.confirmedBody", {
                                    email: persona.email,
                                })}
                            </p>
                            <div className={styles.timeline}>
                                {STEPS.map((step, index) => (
                                    <span
                                        key={step.label}
                                        className={styles.step}
                                    >
                                        <span
                                            className={styles.stepTrack({
                                                done: index === 0,
                                            })}
                                        />
                                        <span
                                            className={styles.stepDot({
                                                done: index === 0,
                                            })}
                                        />
                                        <span className={styles.stepLabel}>
                                            {t(step.label)}
                                        </span>
                                        <span className={styles.stepDate}>
                                            {t(step.date)}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={checkout.box}>
                        <div className={styles.boxBody}>
                            <h2 className={styles.boxTitle}>
                                {t("thankYou.customer")}
                            </h2>
                            <div className={styles.infoGrid}>
                                <span className={styles.infoItem}>
                                    <span className={styles.infoLabel}>
                                        {t("thankYou.contact")}
                                    </span>
                                    <span className={styles.infoMuted}>
                                        {persona.email}
                                    </span>
                                </span>
                                <span className={styles.infoItem}>
                                    <span className={styles.infoLabel}>
                                        {t("thankYou.address")}
                                    </span>
                                    <span className={styles.infoMuted}>
                                        {fullName(persona)}
                                    </span>
                                    <span className={styles.infoMuted}>
                                        {persona.address.line}
                                    </span>
                                    <span className={styles.infoMuted}>
                                        {persona.address.city}
                                    </span>
                                </span>
                                <span className={styles.infoItem}>
                                    <span className={styles.infoLabel}>
                                        {t("thankYou.method")}
                                    </span>
                                    <span className={styles.infoMuted}>
                                        {t("thankYou.methodValue")}
                                    </span>
                                </span>
                                <span className={styles.infoItem}>
                                    <span className={styles.infoLabel}>
                                        {t("thankYou.payment")}
                                    </span>
                                    <span className={styles.infoMuted}>
                                        {t("thankYou.paymentValue", {
                                            brand: persona.card.brand,
                                            last4: persona.card.last4,
                                        })}
                                        {" — "}
                                        {money(orderTotal(order))}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className={checkout.box}>
                        <div className={styles.boxBody}>
                            <h2 className={styles.boxTitle}>
                                {t("thankYou.summary")}
                            </h2>
                            <OrderSummary order={order} />
                        </div>
                    </div>

                    <div className={styles.footer}>
                        <span className={styles.help}>
                            {t("thankYou.help")}
                        </span>
                        <span className={page.storeButton({ tone: "ink" })}>
                            {t("thankYou.continue")}
                        </span>
                    </div>
                </div>
            </div>
            {card === "referrer-collect" && <SharedToast />}
        </div>
    );
}
