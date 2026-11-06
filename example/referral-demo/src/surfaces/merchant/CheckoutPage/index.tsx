import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { useDemoNav } from "@/core/store";
import { orders, orderTotal } from "@/data/merchant";
import { personas } from "@/data/personas";
import { useFormatMoney } from "@/i18n/format";
import { DeviceOverlay } from "@/shell/DeviceOverlay";
import type { CheckoutPageProps } from "@/surfaces/contracts";
import { ApplePayButton, ApplePayMark } from "../components/ApplePayButton";
import { ApplePaySheet } from "../components/ApplePaySheet";
import * as checkout from "../components/checkout.css";
import { useMerchantT } from "../components/format";
import { ChevronDownIcon } from "../components/icons";
import { OrderSummary } from "../components/OrderSummary";
import * as page from "../components/page.css";
import { CheckoutHeader } from "../components/StoreHeader";
import * as styles from "./checkoutPage.css";

/** Lets the page land before the express sheet springs over it. */
const EXPRESS_OPEN_DELAY_MS = 350;

const POLICIES = [
    "checkout.policy.refund",
    "checkout.policy.shipping",
    "checkout.policy.privacy",
    "checkout.policy.terms",
] as const;

function Field({
    label,
    value,
    select = false,
}: {
    label: string;
    value: string;
    select?: boolean;
}) {
    return (
        <span className={styles.field}>
            <span className={styles.fieldLabel}>{label}</span>
            <span className={styles.fieldValue}>{value}</span>
            {select && (
                <ChevronDownIcon size={16} className={styles.selectChevron} />
            )}
        </span>
    );
}

function SummaryToggle({
    total,
    children,
}: {
    total: string;
    children: ReactNode;
}) {
    const t = useMerchantT();
    const [open, setOpen] = useState(false);
    return (
        <div className={styles.band}>
            <button
                type="button"
                className={styles.toggle}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                <span className={styles.toggleLabel}>
                    {t(open ? "checkout.hideSummary" : "checkout.showSummary")}
                    <ChevronDownIcon
                        size={16}
                        className={
                            open
                                ? `${styles.chevron} ${styles.chevronOpen}`
                                : styles.chevron
                        }
                    />
                </span>
                <span className={styles.toggleTotal}>{total}</span>
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        className={styles.summaryPanel}
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.28, ease: "easeOut" }}
                    >
                        <div className={styles.summaryInner}>{children}</div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export function CheckoutPage({
    persona: personaId,
    express,
}: CheckoutPageProps) {
    const t = useMerchantT();
    const money = useFormatMoney();
    const { next } = useDemoNav();
    const persona = personas[personaId];
    const order = orders[personaId];
    const total = orderTotal(order);
    const [sheetOpen, setSheetOpen] = useState(false);
    const openSheet = () => setSheetOpen(true);

    useEffect(() => {
        if (!express) return;
        const timer = setTimeout(
            () => setSheetOpen(true),
            EXPRESS_OPEN_DELAY_MS
        );
        return () => clearTimeout(timer);
    }, [express]);

    const [postalCode = "", ...cityParts] = persona.address.city.split(" ");

    return (
        <div className={`${page.screen} ${checkout.canvas}`}>
            <div className={page.scroll}>
                <CheckoutHeader />
                <SummaryToggle total={money(total)}>
                    <OrderSummary order={order} />
                </SummaryToggle>

                <div className={styles.main}>
                    <section className={styles.express}>
                        <span className={styles.expressLabel}>
                            {t("checkout.express")}
                        </span>
                        <ApplePayButton
                            size="compact"
                            className={page.hint}
                            onClick={openSheet}
                        />
                        <span className={styles.divider}>
                            {t("checkout.or")}
                        </span>
                    </section>

                    <section>
                        <h2 className={checkout.sectionTitle}>
                            {t("checkout.contact")}
                        </h2>
                        <div className={styles.fields}>
                            <Field
                                label={t("checkout.email")}
                                value={persona.email}
                            />
                            <span className={styles.checkbox}>
                                <span className={styles.checkboxBox} />
                                {t("checkout.newsletter")}
                            </span>
                        </div>
                    </section>

                    <section>
                        <h2 className={checkout.sectionTitle}>
                            {t("checkout.delivery")}
                        </h2>
                        <div className={styles.fields}>
                            <Field
                                label={t("checkout.country")}
                                value={t("checkout.countryValue")}
                                select
                            />
                            <span className={styles.fieldRow}>
                                <Field
                                    label={t("checkout.firstName")}
                                    value={persona.firstName}
                                />
                                <Field
                                    label={t("checkout.lastName")}
                                    value={persona.lastName}
                                />
                            </span>
                            <Field
                                label={t("checkout.address")}
                                value={persona.address.line}
                            />
                            <span className={styles.fieldRow}>
                                <Field
                                    label={t("checkout.postalCode")}
                                    value={postalCode}
                                />
                                <Field
                                    label={t("checkout.city")}
                                    value={cityParts.join(" ")}
                                />
                            </span>
                            <Field
                                label={t("checkout.phone")}
                                value={persona.phone}
                            />
                        </div>
                    </section>

                    <section>
                        <h2 className={checkout.sectionTitle}>
                            {t("checkout.shippingMethod")}
                        </h2>
                        <div className={checkout.box}>
                            <div className={styles.option({ selected: true })}>
                                <span
                                    className={styles.radio({ selected: true })}
                                />
                                <span className={styles.optionText}>
                                    <span>{t("checkout.colissimo")}</span>
                                    <span className={checkout.small}>
                                        {t("checkout.colissimoDelay")}
                                    </span>
                                </span>
                                <span className={styles.optionStrong}>
                                    {t("checkout.free")}
                                </span>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className={checkout.sectionTitle}>
                            {t("checkout.payment")}
                        </h2>
                        <p className={styles.paymentNote}>
                            {t("checkout.paymentSecure")}
                        </p>
                        <div
                            className={`${checkout.box} ${styles.optionStack}`}
                        >
                            <div className={styles.option({ selected: false })}>
                                <span
                                    className={styles.radio({
                                        selected: false,
                                    })}
                                />
                                <span className={styles.optionText}>
                                    {t("checkout.card")}
                                </span>
                                <span className={styles.cardLogos}>
                                    <span className={styles.cardLogo}>
                                        VISA
                                    </span>
                                    <span className={styles.cardLogo}>MC</span>
                                    <span className={styles.cardLogo}>CB</span>
                                </span>
                            </div>
                            <span className={styles.optionSeparator} />
                            <div className={styles.option({ selected: true })}>
                                <span
                                    className={styles.radio({ selected: true })}
                                />
                                <span className={styles.optionText}>
                                    <ApplePayMark size={16} />
                                </span>
                            </div>
                            <div className={styles.applePayDetail}>
                                {t("checkout.applePayNote")}
                            </div>
                        </div>
                    </section>

                    <ApplePayButton label="pay" onClick={openSheet} />

                    <nav className={styles.footerLinks}>
                        {POLICIES.map((key) => (
                            <span key={key}>{t(key)}</span>
                        ))}
                    </nav>
                </div>
            </div>

            <DeviceOverlay>
                <AnimatePresence>
                    {sheetOpen && (
                        <ApplePaySheet
                            key="apple-pay"
                            persona={personaId}
                            total={total}
                            onComplete={next}
                        />
                    )}
                </AnimatePresence>
            </DeviceOverlay>
        </div>
    );
}
