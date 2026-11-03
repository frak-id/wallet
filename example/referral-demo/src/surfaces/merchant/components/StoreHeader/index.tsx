import { AnimatePresence, motion } from "motion/react";
import { MaisonLuneLogo } from "@/art";
import { merchant } from "@/data/merchant";
import { useFormatMoney } from "@/i18n/format";
import { useMerchantT } from "../format";
import { BagIcon, BurgerIcon, SearchIcon } from "../icons";
import { iconButton } from "../page.css";
import * as styles from "./storeHeader.css";

const NAV = [
    "nav.new",
    "nav.face",
    "nav.body",
    "nav.sets",
    "nav.journal",
] as const;

function BagButton({ count }: { count: number }) {
    const t = useMerchantT();
    return (
        <button
            type="button"
            className={`${iconButton} ${styles.bag}`}
            aria-label={t("header.bag")}
        >
            <BagIcon />
            <AnimatePresence initial={false}>
                {count > 0 && (
                    <motion.span
                        key={count}
                        className={styles.badge}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                            type: "spring",
                            stiffness: 520,
                            damping: 22,
                        }}
                    >
                        {count}
                    </motion.span>
                )}
            </AnimatePresence>
        </button>
    );
}

/** Storefront header: announcement bar, then a sticky burger · logo · search · bag bar. */
export function StoreHeader({
    bagCount,
    withNav = false,
}: {
    bagCount: number;
    withNav?: boolean;
}) {
    const t = useMerchantT();
    const money = useFormatMoney();
    return (
        <>
            <div className={styles.announcement}>
                {t("header.announcement", {
                    amount: money(merchant.freeShippingFrom, "reward"),
                })}
            </div>
            <header className={styles.header}>
                <div className={styles.bar}>
                    <span className={styles.side}>
                        <button
                            type="button"
                            className={iconButton}
                            aria-label={t("header.menu")}
                        >
                            <BurgerIcon />
                        </button>
                    </span>
                    <span className={styles.logo}>
                        <MaisonLuneLogo />
                    </span>
                    <span className={styles.side}>
                        <button
                            type="button"
                            className={iconButton}
                            aria-label={t("header.search")}
                        >
                            <SearchIcon />
                        </button>
                        <BagButton count={bagCount} />
                    </span>
                </div>
                {withNav && (
                    <nav className={styles.nav}>
                        {NAV.map((key) => (
                            <span key={key} className={styles.navItem}>
                                {t(key)}
                            </span>
                        ))}
                    </nav>
                )}
            </header>
        </>
    );
}

/** Shopify checkout header: the logo alone, the bag at the right. */
export function CheckoutHeader() {
    const t = useMerchantT();
    return (
        <div className={styles.checkoutHeader}>
            <span className={styles.logo}>
                <MaisonLuneLogo />
            </span>
            <button
                type="button"
                className={iconButton}
                aria-label={t("header.bag")}
            >
                <BagIcon />
            </button>
        </div>
    );
}
