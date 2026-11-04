import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { PersonaAvatar } from "@/art";
import { useDemoNav } from "@/core/store";
import { useT } from "@/i18n";
import { useDelayedFlag } from "@/shell/useDelayedFlag";
import type { StoryComposerProps } from "@/surfaces/contracts";
import { IgIcon, type IgIconName } from "../components/IgIcon";
import { StoryCanvas } from "../components/StoryCanvas";
import { instagramMessages } from "../messages";
import * as styles from "./storyComposer.css";

type Phase = "editing" | "posting" | "posted";

const HINT_DELAY_MS = 1500;
const UPLOAD_MS = 950;
const LEAVE_MS = 1750;

const TOOLS: readonly IgIconName[] = [
    "text",
    "sticker",
    "music",
    "sparkles",
    "more",
];

function UploadRing() {
    return (
        <svg
            className={styles.uploadRing}
            viewBox="0 0 36 36"
            aria-hidden="true"
        >
            <circle cx="18" cy="18" r="16.5" className={styles.uploadTrack} />
            <motion.circle
                cx="18"
                cy="18"
                r="16.5"
                className={styles.uploadProgress}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: UPLOAD_MS / 1000, ease: "easeInOut" }}
            />
        </svg>
    );
}

/** Instagram's story editor with Léa's link sticker, one tap from posting. */
export function StoryComposer(_props: StoryComposerProps) {
    const t = useT(instagramMessages);
    const { next } = useDemoNav();
    const [phase, setPhase] = useState<Phase>("editing");
    const hint = useDelayedFlag(HINT_DELAY_MS);

    const editing = phase === "editing";

    // Keyed on `editing`, not `phase`: "posted" must not cancel the pending leave.
    useEffect(() => {
        if (editing) return;
        const posted = window.setTimeout(() => setPhase("posted"), UPLOAD_MS);
        const leave = window.setTimeout(next, LEAVE_MS);
        return () => {
            window.clearTimeout(posted);
            window.clearTimeout(leave);
        };
    }, [editing, next]);

    return (
        <div className={styles.root}>
            <div className={styles.stage}>
                <motion.div
                    className={styles.canvasMotion}
                    animate={
                        editing
                            ? { scale: 1, opacity: 1, borderRadius: 10 }
                            : { scale: 0.06, opacity: 0, borderRadius: 200 }
                    }
                    transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                >
                    <StoryCanvas>
                        <div className={styles.tools}>
                            <span className={styles.tool}>
                                <IgIcon name="close" size={26} />
                            </span>
                            <span className={styles.toolGroup}>
                                {TOOLS.map((name) => (
                                    <span key={name} className={styles.tool}>
                                        <IgIcon name={name} size={26} />
                                    </span>
                                ))}
                            </span>
                        </div>
                    </StoryCanvas>
                </motion.div>
                <AnimatePresence>
                    {phase === "posted" && (
                        <motion.div
                            className={styles.toast}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                        >
                            <span className={styles.toastAvatar}>
                                <PersonaAvatar persona="lea" size={28} />
                            </span>
                            {t("shared")}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className={styles.bottomBar}>
                <button
                    type="button"
                    className={styles.pill({ hint: hint && editing })}
                    onClick={editing ? () => setPhase("posting") : undefined}
                >
                    <span className={styles.pillAvatar}>
                        <PersonaAvatar persona="lea" size={24} />
                        {!editing && <UploadRing />}
                    </span>
                    {t("yourStory")}
                </button>
                <span className={styles.pill({ hint: false })}>
                    <span className={styles.closeFriendsBadge}>
                        <IgIcon name="star" size={13} />
                    </span>
                    {t("closeFriends")}
                </span>
                <span className={styles.sendButton}>
                    <IgIcon name="arrowRight" size={22} />
                </span>
            </div>
        </div>
    );
}
