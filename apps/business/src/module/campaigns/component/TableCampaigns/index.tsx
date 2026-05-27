import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
    type ColumnFiltersState,
    createColumnHelper,
} from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { CampaignDetailsSheet } from "@/module/campaigns/component/CampaignDetailsSheet";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { CampaignsEditBar } from "@/module/campaigns/component/TableCampaigns/CampaignsEditBar";
import { CellRowMenu } from "@/module/campaigns/component/TableCampaigns/CellRowMenu";
import {
    type CampaignTab,
    TableCampaignFilters,
} from "@/module/campaigns/component/TableCampaigns/Filter";
import { isEnded } from "@/module/campaigns/component/TableCampaigns/isEnded";
import {
    type CampaignWithStats,
    useCampaignsWithStats,
} from "@/module/campaigns/hook/useCampaignsWithStats";
import { Table } from "@/module/common/component/Table";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPercent } from "@/module/common/utils/formatPercent";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { campaignSelectionStore } from "@/stores/campaignSelectionStore";
import * as styles from "./table-campaigns.css";

const columnHelper = createColumnHelper<CampaignWithStats>();

function MutedText({ children }: { children: React.ReactNode }) {
    return (
        <Text variant="bodySmall" as="span" color="tertiary">
            {children}
        </Text>
    );
}

function MutedDash() {
    return <MutedText>–</MutedText>;
}

export function TableCampaigns() {
    const { data } = useCampaignsWithStats();
    const merchantId = useActiveMerchantId();
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<
        CampaignWithStats | undefined
    >();
    const selectedIds = campaignSelectionStore((state) => state.selectedIds);
    const toggleSelection = campaignSelectionStore((state) => state.toggle);
    const setManySelection = campaignSelectionStore((state) => state.setMany);
    const clearSelection = campaignSelectionStore((state) => state.clear);

    // Reset bulk selection whenever the active merchant changes — the
    // previous merchant's campaign ids no longer apply.
    useEffect(() => {
        clearSelection();
    }, [merchantId, clearSelection]);

    const selectedCampaigns = useMemo(
        () => (data ?? []).filter((c) => selectedIds.has(c.id)),
        [data, selectedIds]
    );

    const columns = useMemo(
        () =>
            [
                columnHelper.display({
                    id: "select",
                    size: 40,
                    header: ({ table }) => {
                        const visibleIds = table
                            .getRowModel()
                            .rows.map((r) => r.original.id);
                        const selectedVisible = visibleIds.filter((id) =>
                            selectedIds.has(id)
                        );
                        const checked =
                            visibleIds.length > 0 &&
                            selectedVisible.length === visibleIds.length
                                ? true
                                : selectedVisible.length > 0
                                  ? "indeterminate"
                                  : false;
                        return (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                            >
                                <Checkbox
                                    id="campaign-select-all"
                                    checked={checked}
                                    disabled={visibleIds.length === 0}
                                    onCheckedChange={() => {
                                        if (selectedVisible.length > 0) {
                                            clearSelection();
                                        } else {
                                            setManySelection(visibleIds);
                                        }
                                    }}
                                />
                            </div>
                        );
                    },
                    cell: ({ row }) => (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                        >
                            <Checkbox
                                id={`campaign-select-${row.original.id}`}
                                checked={selectedIds.has(row.original.id)}
                                onCheckedChange={() =>
                                    toggleSelection(row.original.id)
                                }
                            />
                        </div>
                    ),
                }),
                columnHelper.accessor("name", {
                    enableSorting: false,
                    size: 160,
                    header: () => "Campaign",
                    cell: ({ getValue }) => getValue() as string,
                }),
                columnHelper.accessor("status", {
                    enableSorting: true,
                    size: 110,
                    header: () => "Status",
                    id: "status",
                    cell: ({ getValue, row }) => (
                        <CampaignStateTag
                            status={getValue()}
                            expiresAt={row.original.expiresAt}
                            bankDistributionStatus={
                                row.original.bankDistributionStatus
                            }
                        />
                    ),
                    filterFn: (row, _, value: CampaignTab) => {
                        if (value === "all") return true;
                        const { status, expiresAt } = row.original;
                        const ended = isEnded(status, expiresAt);
                        if (value === "ended") return ended;
                        // An ended campaign is no longer "active" for filter purposes.
                        if (ended) return false;
                        return status === value;
                    },
                }),
                {
                    id: "date",
                    size: 120,
                    header: () => "Published",
                    accessorFn: (row: CampaignWithStats) => row.publishedAt,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const published = row.original.publishedAt;
                        if (!published) return <MutedDash />;
                        return formatDate(new Date(published));
                    },
                    sortingFn: (
                        a: Row<CampaignWithStats>,
                        b: Row<CampaignWithStats>
                    ) =>
                        sortNullableDate(
                            a.original.publishedAt,
                            b.original.publishedAt
                        ),
                    filterFn: (
                        row: Row<CampaignWithStats>,
                        _: string,
                        value: DateRange
                    ) => {
                        if (!value?.from) return true;
                        const ref =
                            row.original.publishedAt ?? row.original.createdAt;
                        const date = new Date(ref);
                        const from = new Date(value.from);
                        from.setHours(0, 0, 0, 0);
                        const to = value.to ? new Date(value.to) : from;
                        to.setHours(23, 59, 59, 999);
                        return date >= from && date <= to;
                    },
                },
                {
                    id: "endDate",
                    size: 130,
                    header: () => "End date",
                    accessorFn: (row: CampaignWithStats) => row.expiresAt,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const expires = row.original.expiresAt;
                        if (!expires) return <MutedText>No end date</MutedText>;
                        return formatDate(new Date(expires));
                    },
                    sortingFn: (
                        a: Row<CampaignWithStats>,
                        b: Row<CampaignWithStats>
                    ) =>
                        sortNullableDate(
                            a.original.expiresAt,
                            b.original.expiresAt
                        ),
                },
                {
                    id: "sharingRate",
                    size: 130,
                    meta: { align: "right" as const },
                    header: () => "Sharing rate",
                    accessorFn: (row: CampaignWithStats) =>
                        row.stats?.sharingRate ?? null,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const value = row.original.stats?.sharingRate;
                        if (value == null) return <MutedDash />;
                        return (
                            <Text variant="bodySmall" as="p" align="right">
                                {formatPercent(value)}
                            </Text>
                        );
                    },
                    sortingFn: (
                        a: Row<CampaignWithStats>,
                        b: Row<CampaignWithStats>
                    ) =>
                        sortNullableNumber(
                            a.original.stats?.sharingRate,
                            b.original.stats?.sharingRate
                        ),
                },
                {
                    id: "ctr",
                    size: 100,
                    meta: { align: "right" as const },
                    header: () => "CTR",
                    accessorFn: (row: CampaignWithStats) =>
                        row.stats?.ctr ?? null,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const value = row.original.stats?.ctr;
                        if (value == null) return <MutedDash />;
                        return (
                            <Text variant="bodySmall" as="p" align="right">
                                {formatPercent(value)}
                            </Text>
                        );
                    },
                    sortingFn: (
                        a: Row<CampaignWithStats>,
                        b: Row<CampaignWithStats>
                    ) =>
                        sortNullableNumber(
                            a.original.stats?.ctr,
                            b.original.stats?.ctr
                        ),
                },
                {
                    id: "revenue",
                    size: 130,
                    meta: { align: "right" as const },
                    header: () => "Revenue",
                    accessorFn: (row: CampaignWithStats) =>
                        row.stats?.totalRewards ?? null,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const value = row.original.stats?.totalRewards;
                        if (value == null) return <MutedDash />;
                        return (
                            <Text
                                variant="bodySmall"
                                as="p"
                                align="right"
                                weight="medium"
                            >
                                {formatPrice(value, undefined, "EUR")}
                            </Text>
                        );
                    },
                    sortingFn: (
                        a: Row<CampaignWithStats>,
                        b: Row<CampaignWithStats>
                    ) =>
                        sortNullableNumber(
                            a.original.stats?.totalRewards,
                            b.original.stats?.totalRewards
                        ),
                },
                columnHelper.accessor("budgetConfig", {
                    size: 220,
                    meta: { align: "right" as const },
                    header: () => "Budget & Spend",
                    cell: ({ row }) => <CellBudget row={row} />,
                    sortingFn: (a, b) =>
                        sortNullableNumber(
                            a.original.budgetConfig?.[0]?.amount,
                            b.original.budgetConfig?.[0]?.amount
                        ),
                }),
                columnHelper.display({
                    id: "rowMenu",
                    size: 32,
                    header: () => null,
                    cell: ({ row }) => (
                        <div className={styles.rowMenuCell}>
                            <CellRowMenu row={row} merchantId={merchantId} />
                        </div>
                    ),
                }),
            ] as ColumnDef<CampaignWithStats>[],
        [
            merchantId,
            selectedIds,
            toggleSelection,
            setManySelection,
            clearSelection,
        ]
    );

    const rowDataAttributes = useMemo(
        () => ({
            "data-selected": (row: Row<CampaignWithStats>) =>
                selectedIds.has(row.original.id) ? "true" : undefined,
        }),
        [selectedIds]
    );

    return (
        <>
            <Stack space="l">
                <TableCampaignFilters
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                />
                <Stack space="m">
                    {selectedCampaigns.length > 0 && (
                        <CampaignsEditBar
                            merchantId={merchantId}
                            selected={selectedCampaigns}
                        />
                    )}
                    <Table
                        className={styles.campaignsTable}
                        data={data}
                        columns={columns}
                        enableSorting={true}
                        enableFiltering={true}
                        columnFilters={columnFilters}
                        onRowClick={(row) => setSelectedCampaign(row.original)}
                        rowDataAttributes={rowDataAttributes}
                        anySelected={selectedCampaigns.length > 0}
                    />
                </Stack>
            </Stack>
            <CampaignDetailsSheet
                campaign={selectedCampaign}
                onOpenChange={(open) => {
                    if (!open) setSelectedCampaign(undefined);
                }}
            />
        </>
    );
}

function CellBudget({ row }: { row: Row<CampaignWithStats> }) {
    const { budgetConfig, budgetUsed } = row.original;
    const firstBudget = budgetConfig?.[0];

    if (!firstBudget) return <MutedDash />;

    const total = firstBudget.amount;
    const used = budgetUsed?.[firstBudget.label]?.used ?? 0;
    const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;

    return (
        <div>
            <div className={styles.budgetRow}>
                <Text
                    variant="caption"
                    as="span"
                    weight="medium"
                    color="action"
                >
                    {formatPrice(used, undefined, "EUR")}
                </Text>
                <Text
                    variant="caption"
                    as="span"
                    weight="medium"
                    color="secondary"
                >
                    /{formatPrice(total, undefined, "EUR")}
                </Text>
            </div>
            <div className={styles.budgetBarTrack}>
                <div
                    className={styles.budgetBarFill}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function sortNullableNumber(a?: number | null, b?: number | null): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
}

function sortNullableDate(a?: string | null, b?: string | null): number {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return new Date(a).getTime() - new Date(b).getTime();
}
