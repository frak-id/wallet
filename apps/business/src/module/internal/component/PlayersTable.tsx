import type { GamePlayer } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import {
    createDataTableColumnHelper,
    DataTable,
} from "@frak-labs/design-system/components/DataTable";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { RefreshIcon } from "@frak-labs/design-system/icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { TablePagination } from "@/module/common/component/TablePagination";
import { InputSearch } from "@/module/forms/InputSearch";
import {
    gamePlayersQueryOptions,
    LIVE_REFRESH_MS,
    useRefreshPlayers,
} from "../api";
import {
    formatCount,
    formatDateTime,
    shortId,
    ticketBreakdown,
} from "../format";
import { linkButton, mono } from "../internal.css";
import { InstagramBadges } from "./StatusBadges";
import { Panel } from "./ui";

const PAGE_SIZE = 50;

const columnHelper = createDataTableColumnHelper<GamePlayer>();

function matches(player: GamePlayer, search: string): boolean {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [player.wallet, player.identityGroupId, player.instagram.username]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(needle));
}

export function PlayerLink({
    wallet,
    identityGroupId,
}: {
    wallet: string | null;
    identityGroupId: string;
}) {
    const q = wallet ?? identityGroupId;
    return (
        <Link
            to="/internal/lookup"
            search={{ q }}
            className={`${linkButton} ${mono}`}
            title={q}
            onClick={(event) => event.stopPropagation()}
        >
            {shortId(q)}
        </Link>
    );
}

function DrawCell({ player }: { player: GamePlayer }) {
    const { t } = useTranslation();
    if (player.discarded) {
        return (
            <Badge size="small" variant="error">
                {t(`internal.draw.discarded.${player.discarded}`)}
            </Badge>
        );
    }
    return (
        <Badge size="small" variant={player.eligible ? "success" : "warning"}>
            {player.eligible
                ? t("internal.game.players.counts")
                : t("internal.game.players.wouldNotCount")}
        </Badge>
    );
}

export function PlayersTable({ gameId }: { gameId: string }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    const { data, dataUpdatedAt } = useSuspenseQuery(
        gamePlayersQueryOptions(gameId)
    );
    const refresh = useRefreshPlayers(gameId);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const rows = useMemo(
        () => data.players.filter((player) => matches(player, search)),
        [data.players, search]
    );
    const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const columns = useMemo(
        () =>
            columnHelper.columns([
                columnHelper.accessor("wallet", {
                    header: t("internal.game.players.player"),
                    cell: ({ row }) => (
                        <PlayerLink
                            wallet={row.original.wallet}
                            identityGroupId={row.original.identityGroupId}
                        />
                    ),
                }),
                columnHelper.accessor("instagram", {
                    header: t("internal.game.players.instagram"),
                    cell: ({ getValue }) => (
                        <InstagramBadges instagram={getValue()} />
                    ),
                }),
                columnHelper.accessor("joinedAt", {
                    header: t("internal.game.players.joinedAt"),
                    cell: ({ getValue }) => formatDateTime(getValue(), locale),
                }),
                columnHelper.accessor("totalTickets", {
                    header: t("internal.game.players.tickets"),
                    cell: ({ row: { original: player } }) => (
                        <Stack space="none">
                            <Text variant="bodySmall" weight="semiBold">
                                {formatCount(player.totalTickets, locale)}
                                {player.drawTickets !== null &&
                                    player.drawTickets !==
                                        player.totalTickets &&
                                    ` → ${formatCount(player.drawTickets, locale)}`}
                            </Text>
                            <Text variant="caption" color="secondary">
                                {ticketBreakdown(player.tickets, t)}
                            </Text>
                        </Stack>
                    ),
                }),
                columnHelper.accessor("eligible", {
                    header: t("internal.game.players.draw"),
                    cell: ({ row }) => <DrawCell player={row.original} />,
                }),
            ]),
        [t, locale]
    );

    return (
        <Panel
            title={t("internal.game.players.title", {
                count: data.players.length,
            })}
            description={
                data.source === "frozen"
                    ? t("internal.game.players.frozen")
                    : t("internal.game.players.live", {
                          time: formatDateTime(new Date(dataUpdatedAt), locale),
                          seconds: LIVE_REFRESH_MS / 1000,
                      })
            }
            actions={
                <Inline space="s" alignY="center">
                    <InputSearch
                        aria-label={t("internal.game.players.search")}
                        placeholder={t("internal.game.players.search")}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                    {data.source === "live" && (
                        <Button
                            variant="secondary"
                            icon={<RefreshIcon width={16} height={16} />}
                            loading={refresh.isPending}
                            onClick={() => refresh.mutate()}
                        >
                            {t("internal.game.players.refresh")}
                        </Button>
                    )}
                </Inline>
            }
        >
            <DataTable
                data={visible}
                columns={columns}
                enableSorting={false}
                emptyMessage={t("internal.game.players.empty")}
            />
            {rows.length > PAGE_SIZE && (
                <TablePagination
                    totalItems={rows.length}
                    itemsPerPage={PAGE_SIZE}
                    page={page}
                    onPageChange={setPage}
                />
            )}
        </Panel>
    );
}
