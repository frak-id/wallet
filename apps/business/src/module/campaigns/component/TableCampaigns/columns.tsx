import { Text } from "@frak-labs/design-system/components/Text";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { CellRowMenu } from "@/module/campaigns/component/TableCampaigns/CellRowMenu";
import type { CampaignTab } from "@/module/campaigns/component/TableCampaigns/Filter";
import { isEnded } from "@/module/campaigns/component/TableCampaigns/isEnded";
import type { CampaignWithStats } from "@/module/campaigns/hook/useCampaignsWithStats";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPercent } from "@/module/common/utils/formatPercent";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { CellBudget } from "./CellBudget";
import { CellSelect, HeaderSelect } from "./CellSelect";
import { MutedText } from "./MutedText";
import * as styles from "./table-campaigns.css";

const columnHelper = createColumnHelper<CampaignWithStats>();

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

export function useCampaignColumns({
    merchantId,
}: {
    merchantId: string;
}): ColumnDef<CampaignWithStats>[] {
    const { t } = useTranslation();
    return useMemo(
        () =>
            [
                columnHelper.display({
                    id: "select",
                    size: 40,
                    header: ({ table }) => <HeaderSelect table={table} />,
                    cell: ({ row }) => <CellSelect row={row} />,
                }),
                columnHelper.accessor("name", {
                    enableSorting: false,
                    size: 160,
                    header: () => t("campaigns.table.campaign"),
                    cell: ({ getValue }) => getValue() as string,
                }),
                columnHelper.accessor("status", {
                    enableSorting: true,
                    size: 110,
                    header: () => t("campaigns.table.status"),
                    id: "status",
                    cell: ({ getValue, row }) => (
                        <CampaignStateTag
                            status={getValue()}
                            expiresAt={row.original.expiresAt}
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
                    header: () => t("campaigns.table.published"),
                    accessorFn: (row: CampaignWithStats) => row.publishedAt,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const published = row.original.publishedAt;
                        if (!published) return <MutedText>–</MutedText>;
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
                    header: () => t("campaigns.table.endDate"),
                    accessorFn: (row: CampaignWithStats) => row.expiresAt,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const expires = row.original.expiresAt;
                        if (!expires)
                            return (
                                <MutedText>
                                    {t("campaigns.table.noEndDate")}
                                </MutedText>
                            );
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
                    header: () => t("campaigns.table.sharingRate"),
                    accessorFn: (row: CampaignWithStats) =>
                        row.stats?.sharingRate ?? null,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const value = row.original.stats?.sharingRate;
                        if (value == null) return <MutedText>–</MutedText>;
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
                    header: () => t("campaigns.table.ctr"),
                    accessorFn: (row: CampaignWithStats) =>
                        row.stats?.ctr ?? null,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const value = row.original.stats?.ctr;
                        if (value == null) return <MutedText>–</MutedText>;
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
                    header: () => t("campaigns.table.revenue"),
                    accessorFn: (row: CampaignWithStats) =>
                        row.stats?.attributedRevenue ?? null,
                    cell: ({ row }: { row: Row<CampaignWithStats> }) => {
                        const value = row.original.stats?.attributedRevenue;
                        if (value == null) return <MutedText>–</MutedText>;
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
                            a.original.stats?.attributedRevenue,
                            b.original.stats?.attributedRevenue
                        ),
                },
                columnHelper.accessor("budgetConfig", {
                    size: 220,
                    meta: { align: "right" as const },
                    header: () => t("campaigns.table.budgetSpend"),
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
        [t, merchantId]
    );
}
