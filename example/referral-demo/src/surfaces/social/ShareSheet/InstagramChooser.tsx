import { motion } from "motion/react";
import { PersonaAvatar } from "@/art";
import { useT } from "@/i18n";
import { useDelayedFlag } from "@/shell/useDelayedFlag";
import { InstagramAppIcon } from "../components/AppIcons";
import { IgIcon } from "../components/IgIcon";
import { shareSheetMessages } from "../messages";
import * as styles from "./shareSheet.css";

const HINT_DELAY_MS = 700;

/** Instagram's share extension: where the link should go. */
export function InstagramChooser({
    onStory,
    onDismiss,
}: {
    onStory: () => void;
    onDismiss: () => void;
}) {
    const t = useT(shareSheetMessages);
    const hint = useDelayedFlag(HINT_DELAY_MS);

    return (
        <>
            <motion.button
                type="button"
                aria-label={t("close")}
                className={styles.chooserBackdrop}
                onClick={onDismiss}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            />
            <motion.div
                className={styles.chooser}
                role="dialog"
                aria-modal="true"
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                exit={{ y: "110%" }}
                transition={{ type: "spring", damping: 32, stiffness: 360 }}
            >
                <span className={styles.chooserGrabber} />
                <div className={styles.chooserHeader}>
                    <InstagramAppIcon size={26} />
                    <span className={styles.chooserTitle}>
                        {t("igShareTo")}
                    </span>
                </div>
                <button
                    type="button"
                    className={styles.chooserRow({ hint })}
                    onClick={onStory}
                >
                    <span className={styles.chooserStoryAvatar}>
                        <PersonaAvatar persona="lea" size={44} ring="story" />
                        <span className={styles.chooserPlus}>
                            <IgIcon name="plus" size={12} />
                        </span>
                    </span>
                    <span className={styles.chooserText}>
                        <span className={styles.chooserLabel}>
                            {t("igStory")}
                        </span>
                        <span className={styles.chooserHint}>
                            {t("igStoryHint")}
                        </span>
                    </span>
                    <IgIcon
                        name="chevronRight"
                        size={18}
                        className={styles.chooserChevron}
                    />
                </button>
                <div className={styles.chooserRow({ hint: false })}>
                    <span className={styles.chooserGlyph}>
                        <IgIcon name="grid" size={22} />
                    </span>
                    <span className={styles.chooserLabel}>{t("igPost")}</span>
                </div>
                <div className={styles.chooserRow({ hint: false })}>
                    <span className={styles.chooserGlyph}>
                        <IgIcon name="send" size={22} />
                    </span>
                    <span className={styles.chooserLabel}>
                        {t("igMessage")}
                    </span>
                </div>
            </motion.div>
        </>
    );
}
