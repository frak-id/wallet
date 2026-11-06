import { LogoFrakBadge, ShareIcon } from "@frak-labs/design-system/icons";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useDemoNav } from "@/core/store";
import { useT } from "@/i18n";
import { CloseGlyph } from "@/shell/CloseGlyph";
import stepThree from "../../assets/stepThree.webp";
import stepTwo from "../../assets/stepTwo.webp";
import welcome from "../../assets/welcome.webp";
import { BottomSheet } from "../../components/BottomSheet";
import { walletMessages } from "../../messages";
import * as styles from "./appStoreSheet.css";

type InstallState = "get" | "waiting" | "installing" | "open";

/** Fast-tracked, but each beat long enough to read on stage. */
const INSTALL_MS: Partial<Record<InstallState, number>> = {
    waiting: 450,
    installing: 1500,
};

const RING_RADIUS = 13;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function InstallButton() {
    const t = useT(walletMessages);
    const { next } = useDemoNav();
    const [state, setState] = useState<InstallState>("get");

    useEffect(() => {
        const duration = INSTALL_MS[state];
        if (duration === undefined) return;
        const timer = window.setTimeout(
            () => setState(state === "waiting" ? "installing" : "open"),
            duration
        );
        return () => window.clearTimeout(timer);
    }, [state]);

    if (state === "get" || state === "open") {
        return (
            <motion.button
                key={state}
                type="button"
                className={styles.pillButton}
                initial={state === "open" ? { scale: 0.8, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                onClick={() => (state === "get" ? setState("waiting") : next())}
            >
                {t(state === "get" ? "appStore.get" : "appStore.open")}
            </motion.button>
        );
    }

    return (
        <span className={styles.progressButton} role="progressbar">
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
                <circle
                    cx="15"
                    cy="15"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="rgba(120, 120, 128, 0.2)"
                    strokeWidth="2.5"
                />
                {state === "waiting" ? (
                    <motion.circle
                        cx="15"
                        cy="15"
                        r={RING_RADIUS}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={`${RING_LENGTH * 0.25} ${RING_LENGTH}`}
                        style={{ originX: "50%", originY: "50%" }}
                        animate={{ rotate: 360 }}
                        transition={{
                            duration: 0.8,
                            ease: "linear",
                            repeat: Number.POSITIVE_INFINITY,
                        }}
                    />
                ) : (
                    <motion.circle
                        cx="15"
                        cy="15"
                        r={RING_RADIUS}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeDasharray={RING_LENGTH}
                        transform="rotate(-90 15 15)"
                        initial={{ strokeDashoffset: RING_LENGTH }}
                        animate={{ strokeDashoffset: 0 }}
                        transition={{
                            duration: (INSTALL_MS.installing ?? 0) / 1000,
                            ease: [0.3, 0.1, 0.4, 1],
                        }}
                    />
                )}
                {state === "installing" && (
                    <rect
                        x="11"
                        y="11"
                        width="8"
                        height="8"
                        rx="1.5"
                        fill="currentColor"
                    />
                )}
            </svg>
        </span>
    );
}

function InfoStrip() {
    const t = useT(walletMessages);
    const items = [
        {
            label: t("appStore.ratings"),
            value: t("appStore.rating"),
            sub: <span className={styles.stars}>★★★★★</span>,
        },
        {
            label: t("appStore.age"),
            value: t("appStore.ageValue"),
            sub: t("appStore.ageUnit"),
        },
        {
            label: t("appStore.chart"),
            value: t("appStore.chartValue"),
            sub: t("appStore.chartCategory"),
        },
        {
            label: t("appStore.language"),
            value: t("appStore.languageValue"),
            sub: t("appStore.languageMore"),
        },
    ];
    return (
        <div className={styles.infoStrip}>
            {items.map((item) => (
                <div key={item.label} className={styles.infoItem}>
                    <span className={styles.infoLabel}>{item.label}</span>
                    <span className={styles.infoValue}>{item.value}</span>
                    <span className={styles.infoSub}>{item.sub}</span>
                </div>
            ))}
        </div>
    );
}

function Screenshots() {
    const t = useT(walletMessages);
    const shots = [
        { caption: t("appStore.shot.one"), image: welcome },
        { caption: t("appStore.shot.two"), image: stepTwo },
        { caption: t("appStore.shot.three"), image: stepThree },
    ];
    return (
        <div className={styles.shots}>
            {shots.map((shot) => (
                <div key={shot.caption} className={styles.shot}>
                    <span className={styles.shotCaption}>{shot.caption}</span>
                    <span className={styles.shotScreen}>
                        <img
                            src={shot.image}
                            alt=""
                            decoding="async"
                            className={styles.shotImage}
                        />
                    </span>
                </div>
            ))}
        </div>
    );
}

/** The App Store product page the install CTA lands on, as a sheet. */
export function AppStoreSheet({ open }: { open: boolean }) {
    const t = useT(walletMessages);
    return (
        <BottomSheet open={open} look="store" label="Frak">
            <div className={styles.scroller}>
                <div className={styles.topBar}>
                    <button
                        type="button"
                        className={styles.closeButton}
                        aria-label={t("common.close")}
                    >
                        <CloseGlyph />
                    </button>
                </div>
                <div className={styles.appHeader}>
                    <span className={styles.appIcon}>
                        <LogoFrakBadge width={118} height={118} />
                    </span>
                    <div className={styles.appInfo}>
                        <h2 className={styles.appName}>Frak</h2>
                        <span className={styles.appSubtitle}>
                            {t("appStore.subtitle")}
                        </span>
                        <div className={styles.actions}>
                            <InstallButton />
                            <ShareIcon
                                width={22}
                                height={22}
                                className={styles.shareIcon}
                            />
                        </div>
                    </div>
                </div>
                <InfoStrip />
                <Screenshots />
                <p className={styles.description}>
                    {t("appStore.description")}
                </p>
            </div>
        </BottomSheet>
    );
}
