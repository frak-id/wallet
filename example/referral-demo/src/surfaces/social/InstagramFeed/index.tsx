import { clsx } from "clsx";
import type { ReactNode } from "react";
import { MaisonLuneLogo, PersonaAvatar, SceneArt, type SceneId } from "@/art";
import { useDemoNav } from "@/core/store";
import { merchant } from "@/data/merchant";
import { personas } from "@/data/personas";
import { useT } from "@/i18n";
import { useDelayedFlag } from "@/shell/useDelayedFlag";
import type { InstagramFeedProps } from "@/surfaces/contracts";
import { InitialsAvatar, StoryRing } from "../components/Avatar";
import { type Friend, friends } from "../components/friends";
import { IgIcon } from "../components/IgIcon";
import { instagramMessages } from "../messages";
import * as styles from "./instagramFeed.css";

const HINT_DELAY_MS = 1500;
const TRAY_AVATAR = 80;

const trayFriends: readonly { friend: Friend; seen: boolean }[] = [
    { friend: friends.camille, seen: false },
    { friend: friends.hugo, seen: false },
    { friend: friends.manon, seen: true },
    { friend: friends.thomas, seen: true },
];

function TrayItem({
    avatar,
    label,
    muted = false,
    onClick,
    hint = false,
}: {
    avatar: ReactNode;
    label: string;
    muted?: boolean;
    onClick?: () => void;
    hint?: boolean;
}) {
    return (
        <button
            type="button"
            className={clsx(styles.trayItem, onClick && styles.trayItemActive)}
            onClick={onClick}
        >
            <span className={clsx(styles.trayAvatar, hint && styles.trayHint)}>
                {avatar}
            </span>
            <span className={styles.trayLabel({ muted })}>{label}</span>
        </button>
    );
}

function Post({
    avatar,
    author,
    subtitle,
    scene,
    aspect,
    likedBy,
    caption,
    comments,
    age,
}: {
    avatar: ReactNode;
    author: string;
    subtitle?: string;
    scene: SceneId;
    aspect: "square" | "portrait";
    likedBy: string;
    caption: string;
    comments: number;
    age: string;
}) {
    const t = useT(instagramMessages);
    return (
        <article className={styles.post}>
            <header className={styles.postHeader}>
                {avatar}
                <span className={styles.postAuthor}>
                    <span className={styles.handle}>{author}</span>
                    {subtitle && (
                        <span className={styles.postSubtitle}>{subtitle}</span>
                    )}
                </span>
                <IgIcon name="more" size={22} />
            </header>
            <div className={styles.postMedia({ aspect })}>
                <SceneArt scene={scene} />
            </div>
            <div className={styles.postActions}>
                <IgIcon name="heart" />
                <IgIcon name="comment" />
                <IgIcon name="send" />
                <span className={styles.spacer} />
                <IgIcon name="bookmark" />
            </div>
            <div className={styles.postBody}>
                <p className={styles.postLine}>
                    {t("likedBy")}{" "}
                    <span className={styles.handle}>{likedBy}</span>{" "}
                    {t("likedByAnd")}{" "}
                    <span className={styles.handle}>{t("likedByOthers")}</span>
                </p>
                <p className={styles.postLine}>
                    <span className={styles.handle}>{author}</span> {caption}
                </p>
                <p className={styles.postMuted}>
                    {t("viewComments", { count: comments })}
                </p>
                <p className={styles.postAge}>{age}</p>
            </div>
        </article>
    );
}

/** Chloé's Instagram home: Léa's fresh story waits first in the tray. */
export function InstagramFeed(_props: InstagramFeedProps) {
    const t = useT(instagramMessages);
    const { next } = useDemoNav();
    const hint = useDelayedFlag(HINT_DELAY_MS);

    return (
        <div className={styles.root}>
            <header className={styles.header}>
                <span className={styles.wordmark}>
                    Instagram
                    <IgIcon name="chevronDown" size={16} />
                </span>
                <span className={styles.headerIcons}>
                    <span className={styles.badgeHost}>
                        <IgIcon name="heart" size={26} />
                        <span className={styles.dot} />
                    </span>
                    <span className={styles.badgeHost}>
                        <IgIcon name="messenger" size={26} />
                        <span className={styles.countBadge}>2</span>
                    </span>
                </span>
            </header>

            <div className={styles.scroll}>
                <div className={styles.tray}>
                    <TrayItem
                        avatar={
                            <>
                                <PersonaAvatar
                                    persona="chloe"
                                    size={TRAY_AVATAR}
                                    ring="none"
                                />
                                <span className={styles.addBadge}>
                                    <IgIcon name="plus" size={14} />
                                </span>
                            </>
                        }
                        label={t("yourStory")}
                        muted
                    />
                    <TrayItem
                        avatar={
                            <PersonaAvatar
                                persona="lea"
                                size={TRAY_AVATAR}
                                ring="story"
                            />
                        }
                        label={personas.lea.handle}
                        onClick={next}
                        hint={hint}
                    />
                    {trayFriends.map(({ friend, seen }) => (
                        <TrayItem
                            key={friend.handle}
                            avatar={
                                <InitialsAvatar
                                    friend={friend}
                                    size={TRAY_AVATAR}
                                    ring={seen ? "seen" : "story"}
                                />
                            }
                            label={friend.handle}
                        />
                    ))}
                </div>

                <Post
                    avatar={
                        <InitialsAvatar
                            friend={friends.camille}
                            size={34}
                            ring="seen"
                        />
                    }
                    author={friends.camille.handle}
                    subtitle={t("friendLocation")}
                    scene="feedFriend"
                    aspect="portrait"
                    likedBy={friends.hugo.handle}
                    caption={t("friendCaption")}
                    comments={12}
                    age={t("friendAge")}
                />
                <Post
                    avatar={
                        <StoryRing size={34} ring="none">
                            <span className={styles.brandAvatar}>
                                <MaisonLuneLogo variant="monogram" />
                            </span>
                        </StoryRing>
                    }
                    author={merchant.instagram}
                    scene="feedBrand"
                    aspect="square"
                    likedBy={friends.ines.handle}
                    caption={t("brandCaption")}
                    comments={48}
                    age={t("brandAge")}
                />
            </div>

            <nav className={styles.tabBar}>
                <IgIcon name="home" size={26} />
                <IgIcon name="search" size={26} />
                <IgIcon name="newPost" size={26} />
                <IgIcon name="reels" size={26} />
                <PersonaAvatar persona="chloe" size={28} ring="none" />
            </nav>
        </div>
    );
}
