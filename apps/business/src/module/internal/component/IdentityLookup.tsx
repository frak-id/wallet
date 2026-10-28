import type { IdentityLookup as Lookup } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Badge } from "@frak-labs/design-system/components/Badge";
import {
    createDataTableColumnHelper,
    DataTable,
    type DataTableColumnDef,
} from "@frak-labs/design-system/components/DataTable";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { InputSearch } from "@/module/forms/InputSearch";
import { identityLookupQueryOptions } from "../api";
import { formatDateTime, shortId } from "../format";
import { mono, payload } from "../internal.css";
import { PlayerLink } from "./PlayersTable";
import { InstagramBadges } from "./StatusBadges";
import { ActionForm, ErrorNotice, Panel } from "./ui";

type Link = Lookup["referrers"][number];
type Interaction = Lookup["interactions"]["items"][number];
type Asset = Lookup["assets"]["items"][number];

export function IdentityLookup({
    query,
    onSearch,
}: {
    query: string;
    onSearch: (query: string) => void;
}) {
    const { t } = useTranslation();
    const [draft, setDraft] = useState(query);
    const { data, isFetching, error } = useQuery(
        identityLookupQueryOptions(query)
    );

    return (
        <Stack space="l">
            <Panel description={t("internal.lookup.description")}>
                <ActionForm onSubmit={() => onSearch(draft.trim())}>
                    <Inline space="s" alignY="center" wrap>
                        <InputSearch
                            aria-label={t("internal.lookup.placeholder")}
                            placeholder={t("internal.lookup.placeholder")}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                        />
                        <Button type="submit" loading={isFetching}>
                            {t("internal.lookup.submit")}
                        </Button>
                    </Inline>
                </ActionForm>
            </Panel>
            {isFetching && !data && <Skeleton height={200} />}
            <ErrorNotice error={error} tone="warning" />
            {data && !error && <LookupResult lookup={data} />}
        </Stack>
    );
}

function TableSection<TRow extends object>({
    title,
    rows,
    total = rows.length,
    columns,
}: {
    title: string;
    rows: TRow[];
    total?: number;
    columns: DataTableColumnDef<TRow>[];
}) {
    const { t } = useTranslation();
    return (
        <Panel
            title={title}
            badge={
                <Text variant="caption" color="tertiary">
                    {total > rows.length
                        ? t("internal.lookup.latest", {
                              shown: rows.length,
                              total,
                          })
                        : total}
                </Text>
            }
        >
            <DataTable
                data={rows}
                columns={columns}
                emptyMessage={t("internal.lookup.none")}
            />
        </Panel>
    );
}

function useMerchantName() {
    const { merchants } = useMyMerchants();
    return useMemo(() => {
        const names = new Map(merchants.map((m) => [m.id, m.name]));
        return (id: string | null) =>
            id ? (names.get(id) ?? shortId(id, 8, 4)) : "—";
    }, [merchants]);
}

function useLookupColumns() {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    const merchantName = useMerchantName();

    return useMemo(() => {
        const links = createDataTableColumnHelper<Link>();
        const interactions = createDataTableColumnHelper<Interaction>();
        const assets = createDataTableColumnHelper<Asset>();
        const date = { header: t("internal.lookup.date") };
        const merchant = {
            header: t("internal.lookup.merchant"),
            cell: ({ getValue }: { getValue: () => string | null }) =>
                merchantName(getValue()),
        };
        const linkColumns = (side: "referrer" | "referee") =>
            links.columns([
                links.accessor(`${side}IdentityGroupId`, {
                    header: t(`internal.lookup.links.${side}`),
                    cell: ({ getValue }) => (
                        <PlayerLink
                            wallet={null}
                            identityGroupId={getValue()}
                        />
                    ),
                }),
                links.accessor("merchantId", {
                    header: merchant.header,
                    cell: ({ row, getValue }) =>
                        row.original.scope === "cross_merchant"
                            ? t("internal.lookup.links.crossMerchant")
                            : merchantName(getValue()),
                }),
                links.accessor("source", {
                    header: t("internal.lookup.links.source"),
                }),
                links.accessor("createdAt", {
                    ...date,
                    cell: ({ getValue }) => formatDateTime(getValue(), locale),
                }),
                links.accessor("removedAt", {
                    header: t("internal.lookup.links.state"),
                    cell: ({ row }) => (
                        <Badge
                            size="small"
                            variant={
                                row.original.removedAt ? "disabled" : "success"
                            }
                        >
                            {row.original.removedAt
                                ? (row.original.endReason ??
                                  t("internal.lookup.links.removed"))
                                : t("internal.lookup.links.active")}
                        </Badge>
                    ),
                }),
            ]);

        return {
            referrers: linkColumns("referrer"),
            referees: linkColumns("referee"),
            interactions: interactions.columns([
                interactions.accessor("type", {
                    header: t("internal.lookup.type"),
                }),
                interactions.accessor("merchantId", merchant),
                interactions.accessor("createdAt", {
                    ...date,
                    cell: ({ row }) => (
                        <Stack space="none">
                            <span>
                                {formatDateTime(row.original.createdAt, locale)}
                            </span>
                            {row.original.cancelledAt && (
                                <Badge size="small" variant="disabled">
                                    {t("internal.lookup.cancelled")}
                                </Badge>
                            )}
                        </Stack>
                    ),
                }),
                interactions.accessor("payload", {
                    header: t("internal.lookup.payload"),
                    cell: ({ getValue }) => {
                        const json = JSON.stringify(getValue());
                        return (
                            <span className={payload} title={json}>
                                {json}
                            </span>
                        );
                    },
                    enableSorting: false,
                }),
            ]),
            assets: assets.columns([
                assets.accessor("amount", {
                    header: t("internal.lookup.assets.amount"),
                    cell: ({ row }) => (
                        <span className={mono}>
                            {Number(row.original.amount).toLocaleString(
                                locale,
                                { maximumFractionDigits: 4 }
                            )}{" "}
                            {row.original.assetType}
                        </span>
                    ),
                }),
                assets.accessor("status", {
                    header: t("internal.lookup.assets.status"),
                    cell: ({ getValue }) => (
                        <Badge size="small" variant="neutral">
                            {getValue()}
                        </Badge>
                    ),
                }),
                assets.accessor("recipientType", {
                    header: t("internal.lookup.assets.recipient"),
                }),
                assets.accessor("merchantId", merchant),
                assets.accessor("createdAt", {
                    ...date,
                    cell: ({ getValue }) => formatDateTime(getValue(), locale),
                }),
                assets.accessor("onchainTxHash", {
                    header: t("internal.lookup.assets.tx"),
                    cell: ({ getValue }) => {
                        const hash = getValue();
                        return hash ? (
                            <span className={mono} title={hash}>
                                {shortId(hash)}
                            </span>
                        ) : (
                            "—"
                        );
                    },
                }),
            ]),
        };
    }, [t, locale, merchantName]);
}

function LookupResult({ lookup }: { lookup: Lookup }) {
    const { t, i18n } = useTranslation();
    const merchantName = useMerchantName();
    const columns = useLookupColumns();

    return (
        <Stack space="m">
            <Panel title={t("internal.lookup.identity")}>
                {lookup.groups.map((group) => (
                    <Stack key={group.id} space="xs">
                        <Text variant="bodySmall" weight="medium">
                            <span className={mono}>{group.id}</span>
                        </Text>
                        <Text variant="caption" color="secondary">
                            {t("internal.lookup.groupCreated", {
                                date: formatDateTime(
                                    group.createdAt,
                                    i18n.language
                                ),
                            })}
                            {group.mergedGroupIds.length > 0 &&
                                ` · ${t("internal.lookup.merged", { count: group.mergedGroupIds.length })}`}
                        </Text>
                        {group.nodes.map((node) => (
                            <Inline
                                key={`${node.type}:${node.value}:${node.merchantId}`}
                                space="xs"
                                alignY="center"
                            >
                                <Badge
                                    size="small"
                                    variant={
                                        node.unlinkedAt ? "disabled" : "info"
                                    }
                                >
                                    {node.type}
                                </Badge>
                                <Text variant="caption">
                                    <span className={mono}>{node.value}</span>
                                </Text>
                                {node.merchantId && (
                                    <Text variant="caption" color="tertiary">
                                        {merchantName(node.merchantId)}
                                    </Text>
                                )}
                            </Inline>
                        ))}
                    </Stack>
                ))}
                {lookup.instagram.map((instagram) => (
                    <InstagramBadges
                        key={instagram.identityGroupId}
                        instagram={instagram}
                    />
                ))}
            </Panel>
            <TableSection
                title={t("internal.lookup.referrers")}
                rows={lookup.referrers}
                columns={columns.referrers}
            />
            <TableSection
                title={t("internal.lookup.referees")}
                rows={lookup.referees.items}
                total={lookup.referees.total}
                columns={columns.referees}
            />
            <TableSection
                title={t("internal.lookup.interactions")}
                rows={lookup.interactions.items}
                total={lookup.interactions.total}
                columns={columns.interactions}
            />
            <TableSection
                title={t("internal.lookup.assets.title")}
                rows={lookup.assets.items}
                total={lookup.assets.total}
                columns={columns.assets}
            />
        </Stack>
    );
}
