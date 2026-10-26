import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { GiftIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import type { GameResult } from "@/module/game/hook/useGameHistory";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";

const OUTCOME = {
    drawing: {
        badge: "info",
        label: "game.result.badge.drawing",
        title: "game.result.drawing.title",
        description: "game.result.drawing.description",
    },
    won: {
        badge: "success",
        label: "game.result.badge.won",
        title: "game.result.won.title",
        description: "game.result.won.description",
    },
    lost: {
        badge: "neutral",
        label: "game.result.badge.lost",
        title: "game.result.lost.title",
        description: "game.result.lost.description",
    },
    no_winner: {
        badge: "neutral",
        label: "game.result.badge.noWinner",
        title: "game.result.noWinner.title",
        description: "game.result.noWinner.description",
    },
} as const satisfies Record<GameResult["outcome"], unknown>;

function formatEndDate(endsAt: Date | string, locale: string) {
    return new Date(endsAt).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export function OutcomeBadge({ outcome }: { outcome: GameResult["outcome"] }) {
    const { t } = useTranslation();
    return (
        <Badge size="small" variant={OUTCOME[outcome].badge}>
            {t(OUTCOME[outcome].label)}
        </Badge>
    );
}

/** The latest ended game in full: how the draw went, and the numbers behind it. */
export function GameResultCard({ result }: { result: GameResult }) {
    const { t, i18n } = useTranslation();
    const copy = OUTCOME[result.outcome];
    const prize = formatGameAmount(result.game.prizeAmount, i18n.language);
    const stat = (label: string, value: string | number) => (
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

    return (
        <>
            <Card>
                <Stack space="xs" align="center">
                    <OutcomeBadge outcome={result.outcome} />
                    <Text variant="heading2" as="h2" align="center">
                        {t(copy.title, { prize })}
                    </Text>
                    <Text color="secondary" align="center">
                        {t(copy.description)}
                    </Text>
                </Stack>
            </Card>
            {result.discarded && result.outcome !== "won" && (
                <Notice tone="warning">{t("game.result.discarded")}</Notice>
            )}
            <InfoCard>
                {stat(
                    t("game.result.prize"),
                    result.game.prizeDescription ?? prize
                )}
                {stat(t("game.result.myTickets"), result.tickets)}
                {result.totalTickets !== null &&
                    stat(t("game.result.totalTickets"), result.totalTickets)}
                {result.participants !== null &&
                    stat(t("game.result.participants"), result.participants)}
                {stat(
                    t("game.result.endedAt"),
                    formatEndDate(result.game.endsAt, i18n.language)
                )}
            </InfoCard>
            {result.outcome === "won" && (
                <InfoCard>
                    <InfoRow
                        icon={GiftIcon}
                        label={t("game.result.won.cta")}
                        to="/history"
                    />
                </InfoCard>
            )}
        </>
    );
}

/** One line per game: prize, end date, the user's tickets against the total, and the outcome. */
export function PastGames({ results }: { results: GameResult[] }) {
    const { t, i18n } = useTranslation();
    if (results.length === 0) return null;

    return (
        <Stack space="xs">
            <Text weight="semiBold">{t("game.history.title")}</Text>
            {results.map((result) => (
                <Card key={result.game.id} variant="muted">
                    <Spread space="s">
                        <Stack space="xxs">
                            <Text weight="semiBold">
                                {result.game.prizeDescription ??
                                    formatGameAmount(
                                        result.game.prizeAmount,
                                        i18n.language
                                    )}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {t("game.history.endedAt", {
                                    date: formatEndDate(
                                        result.game.endsAt,
                                        i18n.language
                                    ),
                                })}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {result.totalTickets === null
                                    ? t("game.history.tickets", {
                                          count: result.tickets,
                                      })
                                    : t("game.history.ticketsOf", {
                                          count: result.tickets,
                                          total: result.totalTickets,
                                      })}
                            </Text>
                        </Stack>
                        <OutcomeBadge outcome={result.outcome} />
                    </Spread>
                </Card>
            ))}
        </Stack>
    );
}
