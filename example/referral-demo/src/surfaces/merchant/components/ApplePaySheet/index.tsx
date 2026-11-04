import { FaceIdIcon } from "@frak-labs/design-system/icons";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { useSvgId } from "@/art";
import { merchant } from "@/data/merchant";
import {
    fullName,
    type Persona,
    type PersonaId,
    personas,
} from "@/data/personas";
import { useFormatMoney } from "@/i18n/format";
import { ApplePayMark } from "../ApplePayButton";
import { useMerchantT } from "../format";
import { ChevronRightIcon } from "../icons";
import * as styles from "./applePaySheet.css";

type Phase = "confirm" | "scan" | "done";

/** How long the sheet waits for the "double-click" before running it itself. */
const AUTO_CONFIRM_MS = 2400;
const SCAN_MS = 900;
const DONE_MS = 600;

const spring = { type: "spring", stiffness: 320, damping: 34 } as const;

function CardArt({ brand }: { brand: Persona["card"]["brand"] }) {
    const gradientId = useSvgId();
    if (brand === "Mastercard") {
        return (
            <svg
                width="46"
                height="30"
                viewBox="0 0 46 30"
                className={styles.cardArt}
                aria-hidden="true"
            >
                <rect width="46" height="30" rx="4" fill="#1c1c1e" />
                <circle cx="19" cy="15" r="7.5" fill="#eb001b" />
                <circle
                    cx="27"
                    cy="15"
                    r="7.5"
                    fill="#f79e1b"
                    fillOpacity="0.9"
                />
            </svg>
        );
    }
    return (
        <svg
            width="46"
            height="30"
            viewBox="0 0 46 30"
            className={styles.cardArt}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#2a3fa8" />
                    <stop offset="1" stopColor="#141a5e" />
                </linearGradient>
            </defs>
            <rect width="46" height="30" rx="4" fill={`url(#${gradientId})`} />
            <text
                x="41"
                y="25"
                textAnchor="end"
                fill="#fff"
                fontSize="9"
                fontWeight="800"
                fontStyle="italic"
                fontFamily="Arial, sans-serif"
            >
                VISA
            </text>
        </svg>
    );
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
    return (
        <div className={styles.row}>
            {label && <span className={styles.label}>{label}</span>}
            {children}
            <ChevronRightIcon
                size={16}
                strokeWidth={2}
                className={styles.chevron}
            />
        </div>
    );
}

function DoneCheck() {
    return (
        <svg
            width="52"
            height="52"
            viewBox="0 0 52 52"
            fill="none"
            aria-hidden="true"
        >
            <motion.circle
                cx="26"
                cy="26"
                r="23"
                stroke="currentColor"
                strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
            />
            <motion.path
                d="m15.5 26.5 7 7 14-15"
                stroke="currentColor"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.2, duration: 0.25, ease: "easeOut" }}
            />
        </svg>
    );
}

function Footer({ phase }: { phase: Phase }) {
    const t = useMerchantT();
    return (
        <div className={styles.footer}>
            <AnimatePresence mode="wait" initial={false}>
                {phase === "confirm" && (
                    <motion.span
                        key="confirm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        {t("sheet.sideButton")}
                    </motion.span>
                )}
                {phase === "scan" && (
                    <motion.span
                        key="scan"
                        className={styles.faceId}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: [1, 0.55, 1], scale: [1, 0.92, 1] }}
                        exit={{
                            opacity: 0,
                            scale: 0.8,
                            transition: { duration: 0.15 },
                        }}
                        transition={{ duration: 0.9, ease: "easeInOut" }}
                    >
                        <FaceIdIcon width={56} height={56} strokeWidth={2.2} />
                    </motion.span>
                )}
                {phase === "done" && (
                    <motion.span
                        key="done"
                        className={styles.done}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <DoneCheck />
                    </motion.span>
                )}
            </AnimatePresence>
            {phase !== "confirm" && (
                <span className={phase === "done" ? styles.done : undefined}>
                    {t(phase === "done" ? "sheet.done" : "sheet.faceId")}
                </span>
            )}
        </div>
    );
}

/**
 * iOS Apple Pay payment sheet. Mount it inside `AnimatePresence`: it springs up,
 * runs side button → Face ID → Done on its own (a tap skips the wait), then calls `onComplete`.
 */
export function ApplePaySheet({
    persona: personaId,
    total,
    onComplete,
}: {
    persona: PersonaId;
    total: number;
    onComplete: () => void;
}) {
    const t = useMerchantT();
    const money = useFormatMoney();
    const persona = personas[personaId];
    const [phase, setPhase] = useState<Phase>("confirm");

    useEffect(() => {
        const delay = {
            confirm: AUTO_CONFIRM_MS,
            scan: SCAN_MS,
            done: DONE_MS,
        }[phase];
        const timer = setTimeout(() => {
            if (phase === "confirm") setPhase("scan");
            else if (phase === "scan") setPhase("done");
            else onComplete();
        }, delay);
        return () => clearTimeout(timer);
    }, [phase, onComplete]);

    const confirm = () => {
        if (phase === "confirm") setPhase("scan");
    };

    return (
        <>
            <motion.div
                key="apple-pay-backdrop"
                className={styles.backdrop}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={confirm}
            />
            <AnimatePresence>
                {phase === "confirm" && (
                    <motion.div
                        key="apple-pay-hint"
                        className={styles.doubleClick}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        transition={{ delay: 0.35, duration: 0.3 }}
                    >
                        <span className={styles.doubleClickText}>
                            {t("sheet.doubleClick")}
                        </span>
                        <span className={styles.sideButton} />
                    </motion.div>
                )}
            </AnimatePresence>
            <motion.div
                key="apple-pay-sheet"
                className={styles.sheet}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={spring}
                onClick={confirm}
            >
                <div className={styles.head}>
                    <ApplePayMark size={22} />
                    <button
                        type="button"
                        className={styles.close}
                        aria-label={t("sheet.close")}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            aria-hidden="true"
                        >
                            <path
                                d="M1 1l8 8M9 1 1 9"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>
                <Row>
                    <CardArt brand={persona.card.brand} />
                    <span className={styles.value}>
                        <span className={styles.cardName}>
                            {persona.card.brand}
                        </span>
                        <span className={styles.secondary}>
                            •••• {persona.card.last4}
                        </span>
                    </span>
                </Row>
                <Row label={t("sheet.shipping")}>
                    <span className={styles.value}>
                        <span>{fullName(persona)}</span>
                        <span className={styles.secondary}>
                            {persona.address.line}, {persona.address.city}
                        </span>
                    </span>
                </Row>
                <Row label={t("sheet.method")}>
                    <span className={styles.value}>
                        {t("sheet.methodValue")}
                    </span>
                </Row>
                <Row label={t("sheet.contact")}>
                    <span className={styles.value}>
                        <span>{persona.email}</span>
                        <span className={styles.secondary}>
                            {persona.phone}
                        </span>
                    </span>
                </Row>
                <div className={styles.total}>
                    <span className={styles.payTo}>
                        {t("sheet.payTo", {
                            merchant: merchant.name.toUpperCase(),
                        })}
                    </span>
                    <span className={styles.amount}>{money(total)}</span>
                </div>
                <Footer phase={phase} />
            </motion.div>
        </>
    );
}
