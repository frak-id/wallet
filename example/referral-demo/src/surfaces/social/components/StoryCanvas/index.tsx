import { clsx } from "clsx";
import type { ReactNode } from "react";
import { SceneArt } from "@/art";
import { merchant } from "@/data/merchant";
import { campaign } from "@/data/rewards";
import { useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { instagramMessages } from "../../messages";
import { IgIcon } from "../IgIcon";
import * as styles from "./storyCanvas.css";

/** Léa's story as she composes it and as Chloé watches it: one drawing for both. */
export function StoryCanvas({
    className,
    stickerPulse = false,
    onStickerTap,
    stickerBubble,
    children,
}: {
    className?: string;
    stickerPulse?: boolean;
    onStickerTap?: () => void;
    /** Drawn just above the link sticker, e.g. Instagram's "See link" bubble. */
    stickerBubble?: ReactNode;
    /** Overlays on top of the story: progress bars, header, editing tools. */
    children?: ReactNode;
}) {
    const t = useT(instagramMessages);
    const money = useFormatMoney();
    return (
        <div className={clsx(styles.canvas, className)}>
            <SceneArt scene="storyShot" className={styles.scene} />
            <div className={styles.headline}>
                <span className={styles.headlineLabel}>
                    {t("storyHeadline")}
                </span>
            </div>
            <div className={styles.stickerAnchor}>
                <span className={styles.stickerWrap}>
                    <span className={styles.bubbleSlot}>{stickerBubble}</span>
                    <button
                        type="button"
                        className={styles.sticker({ pulse: stickerPulse })}
                        onClick={onStickerTap}
                        tabIndex={onStickerTap ? 0 : -1}
                    >
                        <IgIcon name="link" size={20} />
                        {merchant.domain}
                    </button>
                </span>
                <span className={styles.caption}>
                    {t("storyCaption", {
                        reward: money(campaign.refereeReward, "reward"),
                    })}
                </span>
            </div>
            {children}
        </div>
    );
}
