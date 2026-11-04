import { FaceIdIcon } from "@frak-labs/design-system/icons";
import { AnimatePresence, motion } from "motion/react";
import { type PersonaId, personas } from "@/data/personas";
import { useT } from "@/i18n";
import { CloseGlyph } from "@/shell/CloseGlyph";
import { DeviceOverlay } from "@/shell/DeviceOverlay";
import { walletMessages } from "../../messages";
import { BottomSheet } from "../BottomSheet";
import * as styles from "./passkeyPrompt.css";
import type { PasskeyStage } from "./usePasskeyFlow";

export { type PasskeyStage, usePasskeyFlow } from "./usePasskeyFlow";

const RP_DOMAIN = "wallet.frak.id";

function PasskeyGlyph() {
    return (
        <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">
            <circle cx="22" cy="17" r="10" fill="currentColor" />
            <path
                fill="currentColor"
                d="M3 47c0-10.5 8.5-17 19-17 4.2 0 8 1 11 2.8A12.5 12.5 0 0 0 31 47c0 1.6.3 3.2.9 4.6H7.6A4.6 4.6 0 0 1 3 47Z"
            />
            <circle
                cx="44"
                cy="38"
                r="7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
            />
            <path
                d="M44 45.5V56m0-4.5h4m-4-3.5h3"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
            />
        </svg>
    );
}

function KeyIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <circle
                cx="6.5"
                cy="6.5"
                r="4.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
            />
            <path
                d="M9.5 9.5 16 16m-3-3 1.8-1.8M11 11l1.6-1.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

/** The Face ID check iOS draws over the screen; position it through `DeviceOverlay`. */
export function FaceIdHud({ verified }: { verified: boolean }) {
    const t = useT(walletMessages);
    return (
        <motion.div
            className={styles.hud}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
        >
            <span className={styles.hudGlyph}>
                <AnimatePresence initial={false} mode="wait">
                    {verified ? (
                        <motion.svg
                            key="check"
                            width="64"
                            height="64"
                            viewBox="0 0 48 48"
                            fill="none"
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                        >
                            <title>{t("passkey.faceId")}</title>
                            <motion.path
                                d="M12 25.5 20.5 34 36 15"
                                stroke="currentColor"
                                strokeWidth="3.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.32, ease: "easeOut" }}
                            />
                        </motion.svg>
                    ) : (
                        <motion.span
                            key="face"
                            animate={{
                                scale: [1, 0.9, 1.02, 1],
                                opacity: [1, 0.55, 1, 0.8],
                            }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{
                                duration: 1,
                                repeat: Number.POSITIVE_INFINITY,
                            }}
                        >
                            <FaceIdIcon width={64} height={64} />
                        </motion.span>
                    )}
                </AnimatePresence>
            </span>
            <span className={styles.hudLabel}>{t("passkey.faceId")}</span>
        </motion.div>
    );
}

/** iOS passkey registration: the system sheet, then the Face ID check over it. */
export function PasskeyPrompt({
    persona,
    stage,
    onContinue,
}: {
    persona: PersonaId;
    stage: PasskeyStage;
    onContinue: () => void;
}) {
    const t = useT(walletMessages);
    const { firstName } = personas[persona];
    const sheetOpen =
        stage === "sheet" || stage === "scanning" || stage === "verified";
    const scanning = stage === "scanning" || stage === "verified";

    return (
        <>
            <BottomSheet
                open={sheetOpen}
                look="system"
                label={t("passkey.title", { name: firstName })}
            >
                <button
                    type="button"
                    className={styles.closeButton}
                    aria-label={t("common.close")}
                >
                    <CloseGlyph />
                </button>
                <div className={styles.content}>
                    <span className={styles.glyph}>
                        <PasskeyGlyph />
                    </span>
                    <h2 className={styles.title}>
                        {t("passkey.title", { name: firstName })}
                    </h2>
                    <p className={styles.body}>{t("passkey.body")}</p>
                    <div className={styles.account}>
                        <span className={styles.accountIcon}>
                            <KeyIcon />
                        </span>
                        <span className={styles.accountText}>
                            <span className={styles.accountName}>
                                {firstName}
                            </span>
                            <span className={styles.accountDomain}>
                                {t("passkey.account")} · {RP_DOMAIN}
                            </span>
                        </span>
                    </div>
                    <button
                        type="button"
                        className={styles.continueButton}
                        disabled={scanning}
                        onClick={onContinue}
                    >
                        {t("passkey.continue")}
                    </button>
                    <button type="button" className={styles.otherOptions}>
                        {t("passkey.otherOptions")}
                    </button>
                </div>
            </BottomSheet>
            <DeviceOverlay>
                <AnimatePresence>
                    {scanning && <FaceIdHud verified={stage === "verified"} />}
                </AnimatePresence>
            </DeviceOverlay>
        </>
    );
}
