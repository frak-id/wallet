import { motion } from "motion/react";
import { useMemo } from "react";
import { useDemoNav } from "@/core/store";
import { clock } from "@/data/rewards";
import { useLang, useT } from "@/i18n";
import { LOCALES } from "@/i18n/format";
import { useDelayedFlag } from "@/shell/useDelayedFlag";
import type { LockScreenProps } from "@/surfaces/contracts";
import { lockScreenMessages } from "../messages";
import {
    CameraGlyph,
    FlashlightGlyph,
    LockGlyph,
    MailAppIcon,
    Ripples,
} from "./glyphs";
import * as styles from "./lockScreen.css";

/** The time-skip card holds, the screen wakes, then Frak's notification lands. */
const WAKE_MS = 1500;
const NOTIFICATION_MS = 2500;

const ease = [0.32, 0.72, 0, 1] as const;

function useLockDate(): string {
    const lang = useLang();
    return useMemo(
        () =>
            new Intl.DateTimeFormat(LOCALES[lang], {
                weekday: "long",
                day: "numeric",
                month: "long",
            }).format(new Date()),
        [lang]
    );
}

function TimeSkip({ awake }: { awake: boolean }) {
    const t = useT(lockScreenMessages);
    return (
        <motion.div
            className={styles.timeSkip}
            initial={false}
            animate={{ opacity: awake ? 0 : 1 }}
            transition={{ duration: 0.6 }}
        >
            <span className={styles.timeSkipText}>{t("timeSkip")}</span>
        </motion.div>
    );
}

function VerifiedNotification({ shown }: { shown: boolean }) {
    const t = useT(lockScreenMessages);
    const { next } = useDemoNav();
    return (
        <motion.button
            type="button"
            className={styles.notification}
            aria-label={t("notificationLabel")}
            disabled={!shown}
            onClick={next}
            initial={false}
            animate={
                shown
                    ? { opacity: 1, y: 0, scale: 1 }
                    : { opacity: 0, y: 36, scale: 0.94 }
            }
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
        >
            <span className={styles.appIcon}>
                <MailAppIcon />
            </span>
            <span className={styles.notificationText}>
                <span className={styles.notificationHeader}>
                    <span className={styles.notificationTitle}>
                        {t("notificationApp")}
                    </span>
                    <span className={styles.notificationTime}>
                        {t("notificationTime")}
                    </span>
                </span>
                <span className={styles.notificationSubject}>
                    {t("notificationSubject")}
                </span>
                <span className={styles.notificationBody}>
                    {t("notificationBody")}
                </span>
            </span>
        </motion.button>
    );
}

/** Two days later, Chloé's iPhone wakes for Monerium's "account verified" email. */
export function LockScreen(_props: LockScreenProps) {
    const date = useLockDate();
    const awake = useDelayedFlag(WAKE_MS);
    const notified = useDelayedFlag(NOTIFICATION_MS);

    return (
        <div className={styles.screen}>
            <motion.div
                className={styles.wallpaper}
                initial={false}
                animate={
                    awake
                        ? { opacity: 1, scale: 1 }
                        : { opacity: 0.35, scale: 1.06 }
                }
                transition={{ duration: 1, ease }}
            >
                <Ripples className={styles.ripples} />
            </motion.div>
            <div className={styles.top}>
                <LockGlyph className={styles.lock} />
                <span className={styles.date}>{date}</span>
                <span className={styles.clock}>{clock.transfer}</span>
            </div>
            <div className={styles.notifications}>
                <VerifiedNotification shown={notified} />
            </div>
            <div className={styles.quickActions} aria-hidden="true">
                <span className={styles.quickAction}>
                    <FlashlightGlyph />
                </span>
                <span className={styles.quickAction}>
                    <CameraGlyph />
                </span>
            </div>
            <TimeSkip awake={awake} />
        </div>
    );
}
