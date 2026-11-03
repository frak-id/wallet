import type { GameAdmin } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    createDataTableColumnHelper,
    DataTable,
} from "@frak-labs/design-system/components/DataTable";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { PlusIcon, RefreshIcon } from "@frak-labs/design-system/icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { gamesQueryOptions, useRunDraws, useSetGameStatus } from "../api";
import { formatCount, formatDateTime, formatEur, gamePhase } from "../format";
import { codeCell } from "../internal.css";
import { CreateGameForm } from "./CreateGameForm";
import { BudgetBar } from "./GameSetup";
import { DrawStatusBadge, GamePhaseBadge } from "./StatusBadges";
import { ErrorNotice } from "./ui";

export function GamesSection() {
    const { t } = useTranslation();
    const [creating, setCreating] = useState(false);
    const runDraws = useRunDraws();

    return (
        <Stack space="m">
            <Spread space="m">
                <Text as="h2" variant="heading3">
                    {t("internal.game.list.title")}
                </Text>
                <Inline space="s">
                    <Button
                        variant="secondary"
                        icon={<RefreshIcon width={16} height={16} />}
                        loading={runDraws.isPending}
                        onClick={() => runDraws.mutate()}
                    >
                        {t("internal.game.list.runDraws")}
                    </Button>
                    {!creating && (
                        <Button
                            icon={<PlusIcon width={16} height={16} />}
                            onClick={() => setCreating(true)}
                        >
                            {t("internal.game.list.create")}
                        </Button>
                    )}
                </Inline>
            </Spread>
            {runDraws.data && (
                <Notice tone="success" role="status">
                    {t("internal.game.list.runDrawsResult", runDraws.data)}
                </Notice>
            )}
            <ErrorNotice error={runDraws.error} />
            {creating && <CreateGameForm onClose={() => setCreating(false)} />}
            <GamesTable />
        </Stack>
    );
}

const columnHelper = createDataTableColumnHelper<GameAdmin>();

function GamesTable() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { data: games } = useSuspenseQuery(gamesQueryOptions());
    const locale = i18n.language;

    const columns = useMemo(
        () =>
            columnHelper.columns([
                columnHelper.accessor("code", {
                    header: t("internal.game.list.code"),
                    cell: ({ getValue }) => (
                        <span className={codeCell}>{getValue()}</span>
                    ),
                }),
                columnHelper.accessor("status", {
                    header: t("internal.game.list.phase"),
                    cell: ({ row }) => (
                        <GamePhaseBadge phase={gamePhase(row.original)} />
                    ),
                    enableSorting: false,
                }),
                columnHelper.accessor("startsAt", {
                    header: t("internal.game.list.window"),
                    cell: ({ row }) => (
                        <Stack space="none">
                            <Text variant="bodySmall">
                                {formatDateTime(row.original.startsAt, locale)}
                            </Text>
                            <Text variant="caption" color="secondary">
                                → {formatDateTime(row.original.endsAt, locale)}
                            </Text>
                        </Stack>
                    ),
                    sortFn: "datetime",
                }),
                columnHelper.accessor("prizeAmount", {
                    header: t("internal.game.list.prize"),
                    cell: ({ row }) => (
                        <Stack space="none">
                            <Text variant="bodySmall" weight="medium">
                                {formatEur(row.original.prizeAmount, locale)}
                            </Text>
                            {row.original.sponsor && (
                                <Text variant="caption" color="secondary">
                                    {row.original.sponsor.name}
                                </Text>
                            )}
                        </Stack>
                    ),
                }),
                columnHelper.accessor("participants", {
                    header: t("internal.game.list.players"),
                    cell: ({ getValue }) => formatCount(getValue(), locale),
                    meta: { align: "right" },
                }),
                columnHelper.accessor("rule", {
                    header: t("internal.game.list.budget"),
                    cell: ({ getValue }) => {
                        const rule = getValue();
                        return rule ? <BudgetBar budget={rule.budget} /> : "—";
                    },
                    enableSorting: false,
                }),
                columnHelper.accessor("draw", {
                    header: t("internal.game.list.draw"),
                    cell: ({ getValue }) => {
                        const draw = getValue();
                        return draw ? (
                            <DrawStatusBadge status={draw.status} />
                        ) : (
                            "—"
                        );
                    },
                    enableSorting: false,
                }),
                columnHelper.display({
                    id: "actions",
                    cell: ({ row }) => <PauseToggle game={row.original} />,
                    meta: { align: "right" },
                }),
            ]),
        [t, locale]
    );

    return (
        <Card radius="m" padding="none">
            <DataTable
                data={games}
                columns={columns}
                emptyMessage={t("internal.game.list.empty")}
                onRowClick={(row) =>
                    navigate({
                        to: "/internal/game/$gameId",
                        params: { gameId: row.original.id },
                    })
                }
            />
        </Card>
    );
}

export function PauseToggle({ game }: { game: GameAdmin }) {
    const { t } = useTranslation();
    const setStatus = useSetGameStatus(game.id);
    if (gamePhase(game) === "ended") return null;
    const paused = game.status === "paused";
    return (
        <Button
            variant="secondary"
            size="small"
            loading={setStatus.isPending}
            onClick={(event) => {
                event.stopPropagation();
                setStatus.mutate(paused ? "active" : "paused");
            }}
        >
            {paused ? t("internal.game.resume") : t("internal.game.pause")}
        </Button>
    );
}
