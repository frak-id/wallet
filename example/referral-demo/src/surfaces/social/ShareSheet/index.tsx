import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { PersonaAvatar, ProductArt } from "@/art";
import { useDemoNav } from "@/core/store";
import { heroProductId, merchant, products } from "@/data/merchant";
import { personas } from "@/data/personas";
import { useLang, useT } from "@/i18n";
import { CloseGlyph } from "@/shell/CloseGlyph";
import { DeviceOverlay } from "@/shell/DeviceOverlay";
import { useDelayedFlag } from "@/shell/useDelayedFlag";
import type { ShareSheetProps } from "@/surfaces/contracts";
import {
    AirDropAppIcon,
    InstagramAppIcon,
    MailAppIcon,
    MessagesAppIcon,
    NotesAppIcon,
    WhatsAppAppIcon,
} from "../components/AppIcons";
import { InitialsAvatar } from "../components/Avatar";
import { friends } from "../components/friends";
import { FrakSharingPage } from "../FrakSharingPage";
import { shareSheetMessages } from "../messages";
import { ActionGlyph, type ActionGlyphName } from "./ActionGlyph";
import { InstagramChooser } from "./InstagramChooser";
import * as styles from "./shareSheet.css";

const sheetSpring = { type: "spring", damping: 34, stiffness: 340 } as const;
const HINT_DELAY_MS = 1200;
const CONTACT_GREY = ["#c7c7cc", "#8e8e93"] as const;

function Person({
    avatar,
    name,
    badge,
}: {
    avatar: ReactNode;
    name: string;
    badge: ReactNode;
}) {
    return (
        <div className={styles.person}>
            <span className={styles.personAvatar}>
                {avatar}
                <span className={styles.personBadge}>{badge}</span>
            </span>
            <span className={styles.personName}>{name}</span>
        </div>
    );
}

function App({
    icon,
    label,
    onClick,
    hint = false,
}: {
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    hint?: boolean;
}) {
    return (
        <button type="button" className={styles.app} onClick={onClick}>
            <span
                className={clsx(styles.appIcon, hint && styles.appIconHinted)}
            >
                {icon}
                {hint && <span className={styles.appHint} />}
            </span>
            <span className={styles.appLabel}>{label}</span>
        </button>
    );
}

const ACTIONS: readonly {
    key: "copy" | "readingList" | "bookmark" | "favourites" | "findOnPage";
    glyph: ActionGlyphName;
}[] = [
    { key: "copy", glyph: "copy" },
    { key: "readingList", glyph: "glasses" },
    { key: "bookmark", glyph: "book" },
    { key: "favourites", glyph: "star" },
    { key: "findOnPage", glyph: "find" },
];

/** The iOS share sheet Safari opens from the sharing page's "Share" button. */
export function ShareSheet(_props: ShareSheetProps) {
    const t = useT(shareSheetMessages);
    const lang = useLang();
    const { next } = useDemoNav();
    const hint = useDelayedFlag(HINT_DELAY_MS);
    const [chooser, setChooser] = useState(false);

    const chloe = personas.chloe;

    return (
        <div className={styles.root}>
            <div className={styles.page}>
                <FrakSharingPage inert />
            </div>
            <DeviceOverlay>
                <motion.div
                    className={styles.backdrop}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                />
                <motion.div
                    className={styles.sheet}
                    initial={{ y: "105%" }}
                    animate={{ y: 0, scale: chooser ? 0.94 : 1 }}
                    transition={sheetSpring}
                    role="dialog"
                    aria-modal="true"
                >
                    <span className={styles.grabber} />
                    <div className={styles.preview}>
                        <span className={styles.previewThumb}>
                            <ProductArt
                                productId={heroProductId}
                                variant="packshot"
                            />
                        </span>
                        <span className={styles.previewText}>
                            <span className={styles.previewTitle}>
                                {products[heroProductId].name[lang]} —{" "}
                                {merchant.name}
                            </span>
                            <span className={styles.previewDomain}>
                                {merchant.domain}
                            </span>
                            <span className={styles.previewOptions}>
                                {t("options")}
                                <svg
                                    width="7"
                                    height="11"
                                    viewBox="0 0 7 11"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="m1.2 1 4.3 4.5L1.2 10"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </span>
                        </span>
                        <span className={styles.closeButton} aria-hidden="true">
                            <CloseGlyph />
                        </span>
                    </div>

                    <div className={styles.scroll}>
                        <div className={styles.row}>
                            <Person
                                avatar={
                                    <PersonaAvatar persona="chloe" size={64} />
                                }
                                name={chloe.firstName}
                                badge={<MessagesAppIcon size={22} />}
                            />
                            <Person
                                avatar={
                                    <InitialsAvatar
                                        friend={{
                                            name: t("mum"),
                                            tones: CONTACT_GREY,
                                        }}
                                        size={64}
                                    />
                                }
                                name={t("mum")}
                                badge={<WhatsAppAppIcon size={22} />}
                            />
                            <Person
                                avatar={
                                    <InitialsAvatar
                                        friend={friends.ines}
                                        size={64}
                                    />
                                }
                                name={friends.ines.name}
                                badge={<InstagramAppIcon size={22} />}
                            />
                            <Person
                                avatar={
                                    <InitialsAvatar
                                        friend={friends.camille}
                                        size={64}
                                    />
                                }
                                name={friends.camille.name}
                                badge={<MessagesAppIcon size={22} />}
                            />
                            <Person
                                avatar={
                                    <InitialsAvatar
                                        friend={friends.hugo}
                                        size={64}
                                    />
                                }
                                name={friends.hugo.name}
                                badge={<AirDropAppIcon size={22} />}
                            />
                        </div>

                        <div className={styles.row}>
                            <App
                                icon={<AirDropAppIcon />}
                                label={t("airdrop")}
                            />
                            <App
                                icon={<MessagesAppIcon />}
                                label={t("messages")}
                            />
                            <App
                                icon={<InstagramAppIcon />}
                                label={t("instagram")}
                                hint={hint && !chooser}
                                onClick={() => setChooser(true)}
                            />
                            <App
                                icon={<WhatsAppAppIcon />}
                                label={t("whatsapp")}
                            />
                            <App icon={<MailAppIcon />} label={t("mail")} />
                            <App icon={<NotesAppIcon />} label={t("notes")} />
                        </div>

                        <ul className={styles.actions}>
                            {ACTIONS.map(({ key, glyph }) => (
                                <li key={key} className={styles.action}>
                                    {t(key)}
                                    <ActionGlyph name={glyph} />
                                </li>
                            ))}
                        </ul>
                        <span className={styles.editActions}>
                            {t("editActions")}
                        </span>
                    </div>
                </motion.div>

                <AnimatePresence>
                    {chooser && (
                        <InstagramChooser
                            onStory={next}
                            onDismiss={() => setChooser(false)}
                        />
                    )}
                </AnimatePresence>
            </DeviceOverlay>
        </div>
    );
}
