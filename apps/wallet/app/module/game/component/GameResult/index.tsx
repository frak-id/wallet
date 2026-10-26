import { Badge } from "@frak-labs/design-system/components/Badge";
import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { GiftIcon, HourglassIcon } from "@frak-labs/design-system/icons";
import { Ticket, TicketX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import type { GameResult } from "@/module/game/hook/useGameHistory";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { formatGameDate } from "@/module/game/utils/formatGameDate";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

const OUTCOME = {
    drawing: {
        icon: HourglassIcon,
        tone: "action",
        badge: "info",
        label: "game.result.badge.drawing",
        title: "game.result.drawing.title",
        description: "game.result.drawing.description",
    },
    won: {
        icon: GiftIcon,
        tone: "action",
        badge: "success",
        label: "game.result.badge.won",
        title: "game.result.won.title",
        description: "game.result.won.description",
    },
    lost: {
        icon: Ticket,
        tone: "neutral",
        badge: "neutral",
        label: "game.result.badge.lost",
        title: "game.result.lost.title",
        description: "game.result.lost.description",
    },
    no_winner: {
        icon: TicketX,
        tone: "neutral",
        badge: "neutral",
        label: "game.result.badge.noWinner",
        title: "game.result.noWinner.title",
        description: "game.result.noWinner.description",
    },
} as const satisfies Record<GameResult["outcome"], unknown>;

const SOURCES = [
    "join",
    "purchase",
    "referredPurchase",
    "referredSignup",
    "brandShare",
] as const satisfies readonly (keyof GameResult["ticketsBySource"])[];

/** Tickets that went into the draw: none once they were thrown out. */
function countedTickets(result: GameResult) {
    return result.discarded ? 0 : result.tickets;
}

export function OutcomeBadge({ outcome }: { outcome: GameResult["outcome"] }) {
    const { t } = useTranslation();
    return (
        <Badge size="small" variant={OUTCOME[outcome].badge}>
            {t(OUTCOME[outcome].label)}
        </Badge>
    );
}

/** How the draw went for the user, led by an icon for the outcome. */
export function OutcomeHero({ result }: { result: GameResult }) {
    const { t, i18n } = useTranslation();
    const copy = OUTCOME[result.outcome];
    const Icon = copy.icon;
    const prize = formatGameAmount(result.game.prizeAmount, i18n.language);

    return (
        <Stack space="m" align="center">
            <IconCircle size="lg" tone={copy.tone}>
                <Icon width={24} height={24} />
            </IconCircle>
            <Stack space="xs" align="center">
                <Text variant="heading2" as="h2" align="center">
                    {t(copy.title, { prize })}
                </Text>
                <Text color="secondary" align="center">
                    {t(copy.description)}
                </Text>
            </Stack>
        </Stack>
    );
}

function Stat({ label, value }: { label: string; value: string | number }) {
    return (
        <InfoRow
            labelVariant="bodySmall"
            labelColor="secondary"
            label={label}
            action={
                <Text variant="bodySmall" weight="medium">
                    {value}
                </Text>
            }
        />
    );
}

/**
 * The numbers behind a result, where the user's tickets came from, and the
 * way to the prize for a winner: a link, or `onSeePrize` from inside a modal.
 */
export function GameResultDetail({
    result,
    onSeePrize,
}: {
    result: GameResult;
    onSeePrize?: () => void;
}) {
    const { t, i18n } = useTranslation();
    const sources = SOURCES.filter((source) => result.ticketsBySource[source]);

    return (
        <>
            {result.outcome === "won" && (
                <InfoCard>
                    <InfoRow
                        icon={GiftIcon}
                        label={t("game.result.won.cta")}
                        {...(onSeePrize
                            ? { onClick: onSeePrize }
                            : { to: "/history" })}
                    />
                </InfoCard>
            )}
            {result.discarded && result.outcome !== "won" && (
                <Notice tone="warning">{t("game.result.discarded")}</Notice>
            )}
            <InfoCard>
                <Stat
                    label={t("game.result.prize")}
                    value={
                        result.game.prizeDescription ??
                        formatGameAmount(result.game.prizeAmount, i18n.language)
                    }
                />
                <Stat
                    label={t("game.result.endedAt")}
                    value={formatGameDate(result.game.endsAt, i18n.language)}
                />
                {result.participants !== null && (
                    <Stat
                        label={t("game.result.participants")}
                        value={result.participants}
                    />
                )}
                {result.totalTickets !== null && (
                    <Stat
                        label={t("game.result.totalTickets")}
                        value={result.totalTickets}
                    />
                )}
                <Stat
                    label={t("game.result.myTickets")}
                    value={countedTickets(result)}
                />
            </InfoCard>
            {sources.length > 0 && (
                <Stack space="xs">
                    <Text weight="semiBold">
                        {t("game.result.sources.title")}
                    </Text>
                    <InfoCard>
                        {sources.map((source) => (
                            <Stat
                                key={source}
                                label={t(`game.result.sources.${source}`)}
                                value={result.ticketsBySource[source]}
                            />
                        ))}
                    </InfoCard>
                </Stack>
            )}
        </>
    );
}

/** The latest ended game in full, at the top of the game page. */
export function GameResultCard({ result }: { result: GameResult }) {
    return (
        <>
            <Card>
                <OutcomeHero result={result} />
            </Card>
            <GameResultDetail result={result} />
        </>
    );
}

/** One grouped card, a row per game; a row opens that game's result. */
export function PastGames({ results }: { results: GameResult[] }) {
    const { t } = useTranslation();
    if (results.length === 0) return null;

    return (
        <Stack space="xs">
            <Text weight="semiBold">{t("game.history.title")}</Text>
            <Card padding="none">
                {results.map((result) => (
                    <PastGameRow key={result.game.id} result={result} />
                ))}
            </Card>
        </Stack>
    );
}

function PastGameRow({ result }: { result: GameResult }) {
    const { t, i18n } = useTranslation();
    const tickets = result.discarded
        ? t("game.history.notCounted")
        : result.totalTickets === null
          ? t("game.history.tickets", { count: result.tickets })
          : t("game.history.ticketsOf", {
                count: result.tickets,
                total: result.totalTickets,
            });

    return (
        <button
            type="button"
            className={styles.row}
            onClick={() =>
                modalStore.getState().openModal({ id: "gameResult", result })
            }
        >
            <Inline space="m" padding="m" alignY="center" wrap={false}>
                <Box className={styles.iconBubble}>
                    <Ticket size={20} />
                </Box>
                <Stack space="xxs" className={styles.rowInfo}>
                    <Text weight="medium">
                        {t("game.history.gameOf", {
                            date: formatGameDate(
                                result.game.endsAt,
                                i18n.language
                            ),
                        })}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {tickets}
                    </Text>
                </Stack>
                <Box className={styles.rowBadge}>
                    <OutcomeBadge outcome={result.outcome} />
                </Box>
            </Inline>
        </button>
    );
}
