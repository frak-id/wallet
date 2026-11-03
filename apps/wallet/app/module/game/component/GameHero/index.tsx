import type {
    CurrentGameResponse,
    TicketSource,
} from "@frak-labs/backend-elysia/domain/game/schemas";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { LockIcon } from "@frak-labs/design-system/icons";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { useNow } from "@/module/game/hook/useNow";
import { formatGameEnd } from "@/module/game/utils/formatGameDate";
import { countdownOf, endsInOf } from "@/module/game/utils/gameCountdown";
import type { GameGains } from "@/module/game/utils/gameGains";
import * as styles from "./index.css";

const SOURCE_LABELS = {
    join: "game.page.hero.sources.join",
    instagramCertified: "game.page.hero.sources.instagramCertified",
    purchase: "game.page.hero.sources.purchase",
    referredPurchase: "game.page.hero.sources.referredPurchase",
    referredSignup: "game.page.hero.sources.referredSignup",
    brandShare: "game.page.hero.sources.brandShare",
} as const satisfies Record<TicketSource, string>;

type CardVariants = Omit<
    NonNullable<Parameters<typeof styles.card>[0]>,
    "position"
>;

/** The gradient card both game heroes sit on; `overlay` lies under the content. */
export function HeroCard({
    overlay,
    children,
}: {
    overlay?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className={styles.hero}>
            {overlay}
            <Stack space="s" align="center" className={styles.content}>
                {children}
            </Stack>
        </div>
    );
}

/** Three stacked tickets, `face` on the front one; `children` sit on the deck's corner. */
export function TicketDeck({
    face,
    cards,
    front,
    children,
}: {
    face: ReactNode;
    cards?: CardVariants;
    front?: CardVariants;
    children?: ReactNode;
}) {
    return (
        <div className={styles.deck} aria-hidden="true">
            <span className={styles.card({ ...cards, position: "left" })} />
            <span className={styles.card({ ...cards, position: "right" })} />
            <span
                className={styles.card({
                    ...cards,
                    ...front,
                    position: "front",
                })}
            >
                {face}
            </span>
            {children}
        </div>
    );
}

/** A white disc on the deck's corner; `out` plays it off as the tickets unlock. */
export function DeckBadge({
    icon: Icon,
    out = false,
}: {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    out?: boolean;
}) {
    return (
        <span className={styles.padlock({ out })}>
            <Icon width={18} height={18} />
        </span>
    );
}

/** The tickets just gained, popped on the deck's corner. */
export function GainBadge({ count }: { count: number }) {
    return <span className={styles.gainBadge}>+{count}</span>;
}

/** A tinted line under the hero's title. */
export function HeroChip({
    tone,
    icon,
    children,
}: {
    tone: "success" | "info";
    icon?: ReactNode;
    children: ReactNode;
}) {
    return (
        <span className={styles.chip({ tone })}>
            {icon}
            {children}
        </span>
    );
}

/** A time left on the hero; `urgent` turns it amber. */
export function HeroPill({
    urgent = false,
    children,
}: {
    urgent?: boolean;
    children: ReactNode;
}) {
    return <span className={styles.countdown({ urgent })}>{children}</span>;
}

/** The date tucked under a `HeroPill`. */
export function HeroCaption({ children }: { children: ReactNode }) {
    return (
        <Text variant="caption" color="onAction" className={styles.endsAt}>
            {children}
        </Text>
    );
}

/** The time left as a pill while the game runs, then the end date under it. */
export function HeroEndsAt({ endsAt }: { endsAt: Date | string }) {
    const { t, i18n } = useTranslation();
    const countdown = countdownOf(endsAt, useNow(30_000));

    return (
        <>
            {!countdown.over && (
                <HeroPill urgent={countdown.urgent}>
                    {endsInOf(t, countdown)}
                </HeroPill>
            )}
            <HeroCaption>
                {t("onboarding.game.reward.game.endsAt", {
                    date: formatGameEnd(endsAt, i18n.language),
                })}
            </HeroCaption>
        </>
    );
}

type GameHeroProps = {
    me: CurrentGameResponse["me"];
    prize: string;
    endsAt: Date | string;
    gains: GameGains;
};

/** The player's tickets as a deck, held under a padlock until they count in the draw. */
export function GameHero({ me, prize, endsAt, gains }: GameHeroProps) {
    const { t } = useTranslation();
    const locked = !me.eligible;
    const showPadlock = locked || gains.unlocked;
    const count = me.tickets;
    const title = locked
        ? t("game.page.hero.pending", { count })
        : gains.unlocked
          ? t("game.page.hero.unlocked", { count })
          : t("game.page.hero.drawn", { count });
    const subtitle = locked
        ? t(
              me.instagram === "certified"
                  ? "game.page.hero.subtitleNotFollowing"
                  : "game.page.hero.subtitleNone",
              { count }
          )
        : prize;

    return (
        <HeroCard
            overlay={
                showPadlock && (
                    <span
                        className={styles.lockedLayer({ out: gains.unlocked })}
                    />
                )
            }
        >
            <TicketDeck
                face={count}
                cards={{ locked, unlocking: gains.unlocked }}
                front={{ pop: gains.total > 0 || gains.unlocked }}
            >
                {showPadlock && (
                    <DeckBadge icon={LockIcon} out={gains.unlocked} />
                )}
                {gains.total > 0 && <GainBadge count={gains.total} />}
            </TicketDeck>
            <Text variant="heading3" color="onAction" as="p">
                {title}
            </Text>
            {gains.total > 0 && (
                <HeroChip tone="success">
                    {t("game.page.hero.since", {
                        gains: gains.gains
                            .map((gain) =>
                                t("game.page.hero.gain", {
                                    amount: gain.tickets,
                                    source: t(SOURCE_LABELS[gain.source]),
                                })
                            )
                            .join(", "),
                    })}
                </HeroChip>
            )}
            <Text color="onAction" as="p">
                {subtitle}
            </Text>
            <HeroEndsAt endsAt={endsAt} />
        </HeroCard>
    );
}
