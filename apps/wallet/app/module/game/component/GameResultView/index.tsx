import type {
    GameOutcome,
    GameResult,
} from "@frak-labs/backend-elysia/domain/game/schemas";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    GiftIcon,
    HourglassIcon,
    InstagramIcon,
} from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { HeroCard, TicketDeck } from "@/module/game/component/GameHero";
import * as styles from "@/module/game/component/GameHero/index.css";
import { GameResultDetail } from "@/module/game/component/GameResult";
import { useNow } from "@/module/game/hook/useNow";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import {
    formatGameDate,
    formatGameEnd,
} from "@/module/game/utils/formatGameDate";
import { countdownOf } from "@/module/game/utils/gameCountdown";
import { type GameRecord, recordOf } from "@/module/game/utils/gameRecord";
import { totalTickets } from "@/module/game/utils/ticketAmounts";
import { FRAK_INSTAGRAM_URL } from "@/module/instagram/config";

const OUTCOME = {
    drawing: {
        badge: HourglassIcon,
        face: "tickets",
        title: "game.result.drawing.title",
    },
    pending_verification: {
        badge: GiftIcon,
        face: "prize",
        title: "game.result.pendingVerification.title",
    },
    won: {
        badge: GiftIcon,
        face: "prize",
        title: "game.result.won.title",
    },
    lost: {
        badge: null,
        face: "tickets",
        title: "game.result.lost.title",
    },
    no_winner: {
        badge: null,
        face: "tickets",
        title: "game.result.noWinner.title",
    },
} as const satisfies Record<GameOutcome, unknown>;

/** Where the win is not the point: what is left to say is how the player did against their own best. */
const SHOWS_RECORD: GameOutcome[] = ["drawing", "lost", "no_winner"];

function subtitleOf(
    t: TFunction,
    result: GameResult,
    values: {
        count: number;
        tickets: string;
        total: string | null;
        prize: string;
    }
) {
    const { total, ...rest } = values;
    if (result.discarded && result.outcome !== "won") {
        return t("game.result.hero.discarded");
    }
    switch (result.outcome) {
        case "drawing":
            return total
                ? t("game.result.hero.drawingOf", { ...rest, total })
                : t("game.result.hero.drawing", rest);
        case "pending_verification":
            return t("game.result.hero.pendingVerification", rest);
        case "won":
            return t("game.result.won.description");
        case "lost":
            return total
                ? t("game.result.hero.lostOf", { ...rest, total })
                : t("game.result.hero.lost", rest);
        case "no_winner":
            return t("game.result.noWinner.description");
    }
}

function recordText(record: GameRecord, t: TFunction, language: string) {
    const format = (tickets: number) => tickets.toLocaleString(language);
    switch (record.kind) {
        case "first":
            return t("game.result.hero.record.first", {
                count: record.mine,
                tickets: format(record.mine),
            });
        case "new":
            return t("game.result.hero.record.new", {
                count: record.mine,
                tickets: format(record.mine),
                previous: format(record.previous),
            });
        case "tied":
            return t("game.result.hero.record.tied", {
                count: record.mine,
                tickets: format(record.mine),
                date: formatGameDate(record.bestAt, language),
            });
        case "held":
            return t("game.result.hero.record.held", {
                count: record.best,
                tickets: format(record.best),
                date: formatGameDate(record.bestAt, language),
            });
    }
}

function RecordChip({ record }: { record: GameRecord }) {
    const { t, i18n } = useTranslation();
    const text = recordText(record, t, i18n.language);

    return (
        <span
            className={styles.chip({
                tone:
                    record.kind === "new" || record.kind === "tied"
                        ? "success"
                        : "info",
            })}
        >
            <Trophy size={14} aria-hidden="true" />
            {text}
        </span>
    );
}

/** A drawn player's certify-by date, until it passes. */
function openDeadline(result: GameResult, now: number) {
    if (result.outcome !== "pending_verification" || !result.verifyBy) {
        return null;
    }
    return new Date(result.verifyBy).getTime() > now ? result.verifyBy : null;
}

/** The result as the page's lead: a hero in `GameHero`'s family, the way on, then the numbers behind it. */
export function GameResultView({
    result,
    history,
}: {
    result: GameResult;
    history: GameResult[];
}) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const now = useNow(30_000);
    const { badge: Badge, face, title } = OUTCOME[result.outcome];
    const earned = totalTickets(result.ticketsBySource);
    const prize = formatGameAmount(result.game.prizeAmount, i18n.language);
    const counts = {
        count: earned,
        tickets: earned.toLocaleString(i18n.language),
        total: result.totalTickets?.toLocaleString(i18n.language) ?? null,
    };
    const deadline = openDeadline(result, now);
    const left = deadline ? countdownOf(deadline, now) : null;
    const hoursLeft = left ? left.days * 24 + left.hours : 0;

    return (
        <Stack space="m">
            <HeroCard>
                <TicketDeck
                    face={face === "prize" ? prize : counts.tickets}
                    front={{
                        prize: face === "prize",
                        muted: result.outcome === "lost",
                        pop: true,
                    }}
                >
                    {Badge && (
                        <span className={styles.padlock()}>
                            <Badge width={18} height={18} />
                        </span>
                    )}
                </TicketDeck>
                <Text variant="heading3" color="onAction" as="p">
                    {t(title, { prize })}
                </Text>
                {SHOWS_RECORD.includes(result.outcome) && !result.discarded && (
                    <RecordChip record={recordOf(result, history)} />
                )}
                <Text color="onAction" as="p">
                    {subtitleOf(t, result, { ...counts, prize })}
                </Text>
                {deadline && left ? (
                    <>
                        <span className={styles.countdown({ urgent: true })}>
                            {hoursLeft >= 1
                                ? t("game.result.hero.timeLeftHours", {
                                      hours: hoursLeft,
                                      minutes: left.minutes,
                                  })
                                : t("game.result.hero.timeLeftMinutes", {
                                      minutes: left.minutes,
                                  })}
                        </span>
                        <Text
                            variant="caption"
                            color="onAction"
                            className={styles.endsAt}
                        >
                            {t("game.result.hero.deadline", {
                                date: formatGameEnd(deadline, i18n.language),
                            })}
                        </Text>
                    </>
                ) : (
                    <span className={styles.countdown({})}>
                        {t("game.history.gameOf", {
                            date: formatGameDate(
                                result.game.endsAt,
                                i18n.language
                            ),
                        })}
                    </span>
                )}
            </HeroCard>
            {result.outcome === "pending_verification" && (
                <Button onClick={() => navigate({ to: "/profile/instagram" })}>
                    {t("game.result.pendingVerification.cta")}
                </Button>
            )}
            {result.outcome === "won" && (
                <Button onClick={() => navigate({ to: "/history" })}>
                    {t("game.result.won.cta")}
                </Button>
            )}
            {(result.outcome === "lost" || result.outcome === "no_winner") && (
                <InfoCard>
                    <InfoRow
                        icon={InstagramIcon}
                        label={t("game.result.hero.next")}
                        href={FRAK_INSTAGRAM_URL}
                    />
                </InfoCard>
            )}
            <GameResultDetail result={result} withCta={false} />
        </Stack>
    );
}
