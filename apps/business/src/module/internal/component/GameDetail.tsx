import type { TicketSource } from "@frak-labs/backend-elysia/domain/game/schemas";
import type {
    GameAdmin,
    GamePlayer,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { LegendItem } from "@frak-labs/design-system/components/LegendItem";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Tiles } from "@frak-labs/design-system/components/Tiles";
import { ArrowLeftIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { KpiCard } from "@/module/campaigns/component/KpiCard";
import { LinkButton } from "@/module/common/component/LinkButton";
import { gamePlayersQueryOptions, gamesQueryOptions } from "../api";
import {
    formatCount,
    formatDateTime,
    formatEur,
    gamePhase,
    TICKET_SOURCES,
    toDate,
} from "../format";
import { codeCell, sourceBar } from "../internal.css";
import { DrawPanel } from "./DrawPanel";
import { PauseToggle } from "./GamesSection";
import { PlayersTable } from "./PlayersTable";
import { GamePhaseBadge } from "./StatusBadges";
import { Panel } from "./ui";

const SOURCE_COLOR: Record<TicketSource, string> = {
    join: vars.icon.tertiary,
    instagramCertified: vars.icon.error,
    purchase: vars.icon.action,
    referredPurchase: vars.icon.success,
    referredSignup: vars.icon.warning,
    brandShare: vars.icon.secondary,
};

export function GameDetail({ gameId }: { gameId: string }) {
    const { t } = useTranslation();
    const { data: games } = useSuspenseQuery(gamesQueryOptions());
    const game = games.find((candidate) => candidate.id === gameId);
    const back = (
        <LinkButton
            to="/internal/game"
            variant="ghost"
            size="small"
            icon={<ArrowLeftIcon width={16} height={16} />}
        >
            {t("internal.game.back")}
        </LinkButton>
    );

    if (!game) {
        return (
            <Stack space="m">
                {back}
                <Notice tone="warning">{t("internal.game.notFound")}</Notice>
            </Stack>
        );
    }

    return (
        <Stack space="l">
            {back}
            <GameHeader game={game} />
            <GameStats game={game} />
            {(game.draw || gamePhase(game) === "ended") && (
                <DrawPanel game={game} />
            )}
            <PlayersTable gameId={game.id} />
        </Stack>
    );
}

function GameHeader({ game }: { game: GameAdmin }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    return (
        <Spread space="m" align="top">
            <Stack space="xs">
                <Inline space="s" alignY="center">
                    <Text as="h2" variant="heading2" className={codeCell}>
                        {game.code}
                    </Text>
                    <GamePhaseBadge phase={gamePhase(game)} />
                </Inline>
                <Text variant="bodySmall" color="secondary">
                    {t("internal.game.detail.window", {
                        start: formatDateTime(game.startsAt, locale),
                        end: formatDateTime(game.endsAt, locale),
                    })}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {[
                        t("internal.game.detail.prize", {
                            amount: formatEur(game.prizeAmount, locale),
                        }),
                        game.prizeDescription,
                        game.sponsor &&
                            t("internal.game.detail.sponsor", {
                                name: game.sponsor.name,
                            }),
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </Text>
            </Stack>
            <PauseToggle game={game} />
        </Spread>
    );
}

function timeLeft(game: GameAdmin, t: TFunction): string {
    const end = toDate(game.endsAt)?.getTime() ?? 0;
    const start = toDate(game.startsAt)?.getTime() ?? 0;
    const now = Date.now();
    if (end <= now) return t("internal.game.detail.ended");
    const target = start > now ? start : end;
    const hours = Math.round((target - now) / (60 * 60 * 1000));
    const label =
        hours >= 48
            ? t("internal.game.detail.days", { count: Math.round(hours / 24) })
            : t("internal.game.detail.hours", { count: hours });
    return start > now
        ? t("internal.game.detail.startsIn", { time: label })
        : t("internal.game.detail.endsIn", { time: label });
}

const sum = (players: GamePlayer[], of: (player: GamePlayer) => number) =>
    players.reduce((total, player) => total + of(player), 0);

function statsOf(players: GamePlayer[]) {
    const eligible = players.filter((p) => p.eligible);
    return {
        tickets: sum(players, (p) => p.totalTickets),
        eligibleTickets: sum(eligible, (p) => p.drawTickets ?? p.totalTickets),
        eligible: eligible.length,
        certified: players.filter(
            (p) => p.instagram.level === "certified" && p.instagram.follows
        ).length,
        declared: players.filter((p) => p.instagram.level === "declared")
            .length,
        bySource: Object.fromEntries(
            TICKET_SOURCES.map((source) => [
                source,
                sum(players, (p) => p.tickets[source]),
            ])
        ) as Record<TicketSource, number>,
    };
}

function GameStats({ game }: { game: GameAdmin }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    const { data } = useSuspenseQuery(gamePlayersQueryOptions(game.id));
    const { players, source } = data;
    const stats = useMemo(() => statsOf(players), [players]);
    const budget = game.rule?.budget;
    const left = timeLeft(game, t);
    const kpis = [
        {
            label: t("internal.game.stats.players"),
            amount: formatCount(players.length, locale),
            hint: t(
                source === "frozen"
                    ? "internal.game.stats.eligibleFrozen"
                    : "internal.game.stats.eligibleLive",
                { count: stats.eligible }
            ),
        },
        {
            label: t("internal.game.stats.tickets"),
            amount: formatCount(stats.tickets, locale),
            hint: t("internal.game.stats.ticketsInDraw", {
                count: stats.eligibleTickets,
            }),
        },
        {
            label: t("internal.game.stats.instagram"),
            amount: formatCount(stats.certified, locale),
            hint: t("internal.game.stats.declared", { count: stats.declared }),
        },
        {
            label: t("internal.game.stats.budget"),
            amount: budget ? formatEur(budget.used, locale) : "—",
            hint: budget?.total
                ? t("internal.game.stats.budgetOf", {
                      total: formatEur(budget.total, locale),
                  })
                : left,
        },
    ];

    return (
        <Stack space="m">
            <Tiles columns={{ mobile: 1, tablet: 2, desktop: 4 }} space="m">
                {kpis.map((kpi) => (
                    <KpiCard key={kpi.label} {...kpi} />
                ))}
            </Tiles>
            <Panel
                title={t("internal.game.stats.bySource")}
                actions={
                    <Text variant="caption" color="tertiary">
                        {left}
                    </Text>
                }
            >
                <div className={sourceBar}>
                    {stats.tickets > 0 &&
                        TICKET_SOURCES.map((source) => (
                            <span
                                key={source}
                                style={{
                                    width: `${(stats.bySource[source] / stats.tickets) * 100}%`,
                                    backgroundColor: SOURCE_COLOR[source],
                                }}
                            />
                        ))}
                </div>
                <Inline space="m" wrap>
                    {TICKET_SOURCES.map((source) => (
                        <LegendItem
                            key={source}
                            swatchColor={SOURCE_COLOR[source]}
                        >
                            {t(`internal.tickets.${source}`)} ·{" "}
                            {formatCount(stats.bySource[source], locale)}
                        </LegendItem>
                    ))}
                </Inline>
            </Panel>
        </Stack>
    );
}
