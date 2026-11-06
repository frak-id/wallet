import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { PersonaAvatar } from "@/art";
import { useDemoNav } from "@/core/store";
import { personas } from "@/data/personas";
import { useT } from "@/i18n";
import type { StoryViewerProps } from "@/surfaces/contracts";
import { IgIcon } from "../components/IgIcon";
import { StoryCanvas } from "../components/StoryCanvas";
import { instagramMessages } from "../messages";
import * as styles from "./storyViewer.css";

const SEGMENTS = ["current", "upcoming"] as const;

function LinkBubble({ onOpen }: { onOpen: () => void }) {
    const t = useT(instagramMessages);
    return (
        <motion.button
            type="button"
            className={styles.bubble}
            onClick={onOpen}
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 18, stiffness: 420 }}
        >
            <IgIcon name="link" size={16} />
            {t("seeLink")}
            <span className={styles.bubbleCaret} />
        </motion.button>
    );
}

/** Chloé watching Léa's story; the link sticker is the way in. */
export function StoryViewer(_props: StoryViewerProps) {
    const t = useT(instagramMessages);
    const { next } = useDemoNav();
    const [bubble, setBubble] = useState(false);
    const lea = personas.lea;

    return (
        <div className={styles.root}>
            <div className={styles.stage}>
                <StoryCanvas
                    stickerPulse={!bubble}
                    onStickerTap={bubble ? next : () => setBubble(true)}
                    stickerBubble={
                        <AnimatePresence>
                            {bubble && <LinkBubble onOpen={next} />}
                        </AnimatePresence>
                    }
                >
                    <div className={styles.top}>
                        <div className={styles.progress}>
                            {SEGMENTS.map((segment) => (
                                <span key={segment} className={styles.segment}>
                                    {segment === "current" && (
                                        <span className={styles.segmentFill} />
                                    )}
                                </span>
                            ))}
                        </div>
                        <div className={styles.header}>
                            <PersonaAvatar persona="lea" size={32} />
                            <span className={styles.handle}>{lea.handle}</span>
                            <span className={styles.age}>{t("storyAge")}</span>
                            <span className={styles.spacer} />
                            <IgIcon name="more" size={24} />
                            <IgIcon name="close" size={26} />
                        </div>
                    </div>
                </StoryCanvas>
            </div>
            <div className={styles.bottomBar}>
                <span className={styles.messageField}>{t("sendMessage")}</span>
                <IgIcon name="heart" size={26} />
                <IgIcon name="send" size={26} />
            </div>
        </div>
    );
}
