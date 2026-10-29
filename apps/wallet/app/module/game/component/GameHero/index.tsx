import type {
    CurrentGameResponse,
    TicketSource,
} from "@frak-labs/backend-elysia/domain/game/schemas";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { LockIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNow } from "@/module/game/hook/useNow";
import { formatGameEnd } from "@/module/game/utils/formatGameDate";
import { countdownOf } from "@/module/game/utils/gameCountdown";
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

type GameHeroProps = {
    me: CurrentGameResponse["me"];
    prize: string;
    endsAt: Date | string;
    gains: GameGains;
};

/** The player's tickets as a deck, held under a padlock until they count in the draw. */
export function GameHero({ me, prize, endsAt, gains }: GameHeroProps) {
    const { t, i18n } = useTranslation();
    const countdown = countdownOf(endsAt, useNow(30_000));
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
                    <span className={styles.padlock({ out: gains.unlocked })}>
                        <LockIcon width={18} height={18} />
                    </span>
                )}
                {gains.total > 0 && (
                    <span className={styles.gainBadge}>+{gains.total}</span>
                )}
            </TicketDeck>
            <Text variant="heading3" color="onAction" as="p">
                {title}
            </Text>
            {gains.total > 0 && (
                <span className={styles.chip({ tone: "success" })}>
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
                </span>
            )}
            <Text color="onAction" as="p">
                {subtitle}
            </Text>
            {!countdown.over && (
                <span
                    className={styles.countdown({
                        urgent: countdown.urgent,
                    })}
                >
                    {countdown.days >= 1
                        ? t("game.page.hero.countdownDays", countdown)
                        : t("game.page.hero.countdownHours", countdown)}
                </span>
            )}
            <Text variant="caption" color="onAction" className={styles.endsAt}>
                {t("onboarding.game.reward.game.endsAt", {
                    date: formatGameEnd(endsAt, i18n.language),
                })}
            </Text>
        </HeroCard>
    );
}
