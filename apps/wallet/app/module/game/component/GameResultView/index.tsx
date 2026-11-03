import type {
    GameOutcome,
    GameResult,
} from "@frak-labs/backend-elysia/domain/game/schemas";
import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { InstagramIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import {
    DeckBadge,
    HeroCaption,
    HeroCard,
    HeroChip,
    HeroPill,
    TicketDeck,
} from "@/module/game/component/GameHero";
import { GameResultDetail } from "@/module/game/component/GameResult";
import { useNow } from "@/module/game/hook/useNow";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import {
    formatGameDate,
    formatGameEnd,
} from "@/module/game/utils/formatGameDate";
import { countdownOf } from "@/module/game/utils/gameCountdown";
import { openDeadline, timeLeftOf } from "@/module/game/utils/gameDeadline";
import { OUTCOME } from "@/module/game/utils/gameOutcome";
import { type GameRecord, recordOf } from "@/module/game/utils/gameRecord";
import { totalTickets } from "@/module/game/utils/ticketAmounts";
import { FRAK_INSTAGRAM_URL } from "@/module/instagram/config";

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
        <HeroChip
            tone={
                record.kind === "new" || record.kind === "tied"
                    ? "success"
                    : "info"
            }
            icon={<Trophy size={14} aria-hidden="true" />}
        >
            {text}
        </HeroChip>
    );
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
                    {Badge && <DeckBadge icon={Badge} />}
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
                        <HeroPill urgent>{timeLeftOf(t, left)}</HeroPill>
                        <HeroCaption>
                            {t("game.result.hero.deadline", {
                                date: formatGameEnd(deadline, i18n.language),
                            })}
                        </HeroCaption>
                    </>
                ) : (
                    <HeroPill>
                        {t("game.history.gameOf", {
                            date: formatGameDate(
                                result.game.endsAt,
                                i18n.language
                            ),
                        })}
                    </HeroPill>
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
