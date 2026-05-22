import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
    type CellContext,
    type ColumnFiltersState,
    createColumnHelper,
} from "@tanstack/react-table";
import { Eye, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import {
    ModalArchive,
    ModalDelete,
    ModalPause,
    ModalResume,
} from "@/module/campaigns/component/CampaignActionModals";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { TableCampaignFilters } from "@/module/campaigns/component/TableCampaigns/Filter";
import { useGetCampaigns } from "@/module/campaigns/hook/useGetCampaigns";
import { Table } from "@/module/common/component/Table";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { campaignStore } from "@/stores/campaignStore";
import type { CampaignWithActions } from "@/types/Campaign";
import * as styles from "./table-campaigns.css";

const columnHelper = createColumnHelper<CampaignWithActions>();

export function TableCampaigns() {
    const { data } = useGetCampaigns();
    const merchantId = useActiveMerchantId();
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    const columns = useMemo(
        () =>
            [
                columnHelper.accessor("name", {
                    enableSorting: false,
                    header: () => "Campaign",
                    cell: ({ getValue, row }) => {
                        const isDraft = row.original.status === "draft";
                        const name = getValue() as string;
                        return isDraft ? (
                            <Link
                                to="/m/$merchantId/campaigns/draft/$campaignId"
                                params={{
                                    merchantId,
                                    campaignId: row.original.id,
                                }}
                            >
                                {name}
                            </Link>
                        ) : (
                            <Link
                                to="/m/$merchantId/campaigns/$campaignId"
                                params={{
                                    merchantId,
                                    campaignId: row.original.id,
                                }}
                            >
                                {name}
                            </Link>
                        );
                    },
                }),
                columnHelper.accessor("status", {
                    enableSorting: true,
                    header: () => "Status",
                    id: "status",
                    cell: ({ getValue, row }) => (
                        <CampaignStateTag
                            status={getValue()}
                            bankDistributionStatus={
                                row.original.bankDistributionStatus
                            }
                        />
                    ),
                }),
                {
                    id: "date",
                    header: () => "Date",
                    accessorFn: (row) =>
                        formatDate(new Date(row.publishedAt || row.createdAt)),
                    filterFn: (row, _, value) => {
                        const date = new Date(
                            row.original.publishedAt || row.original.createdAt
                        );
                        return date.getDate() > new Date(value).getDate();
                    },
                },
                columnHelper.accessor("budgetConfig", {
                    header: () => "Budget",
                    cell: ({ row }) => <CellBudget row={row} />,
                }),
                columnHelper.display({
                    header: "Action",
                    cell: ({ row }) => (
                        <CellActions row={row} merchantId={merchantId} />
                    ),
                }),
            ] as ColumnDef<CampaignWithActions>[],
        [merchantId]
    );

    if (!data) {
        return <Skeleton variant="rect" height={250} />;
    }

    return (
        data && (
            <>
                <TableCampaignFilters
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                />
                <Table
                    data={data}
                    columns={columns}
                    enableSorting={true}
                    enableFiltering={true}
                    columnFilters={columnFilters}
                />
            </>
        )
    );
}

function CellBudget({
    row,
}: Pick<CellContext<CampaignWithActions, unknown>, "row">) {
    const budgetConfig = row.original.budgetConfig;
    const budgetUsed = row.original.budgetUsed;
    const firstBudget = budgetConfig?.[0];

    if (!firstBudget) {
        return <span>-</span>;
    }

    const used = budgetUsed?.[firstBudget.label]?.used ?? 0;
    const remaining = firstBudget.amount - used;

    return (
        <Stack as="span" space="xxs">
            <span className={styles.tableBudgetAmount}>
                {formatPrice(remaining, undefined, "EUR")} /{" "}
                {formatPrice(firstBudget.amount, undefined, "EUR")}
            </span>
            <span className={styles.tableBudgetType}>
                {firstBudget.label || "Global"}
            </span>
        </Stack>
    );
}

function CellActions({
    row,
    merchantId,
}: Pick<CellContext<CampaignWithActions, unknown>, "row"> & {
    merchantId: string;
}) {
    const actions = useMemo(() => row.original.actions, [row.original.actions]);
    const reset = campaignStore((state) => state.reset);
    const status = row.original.status;
    const isDraft = status === "draft";
    const isArchived = status === "archived";

    return (
        <div className={styles.tableActions}>
            {isDraft ? (
                <Link
                    to="/m/$merchantId/campaigns/draft/$campaignId"
                    params={{ merchantId, campaignId: row.original.id }}
                    onClick={() => reset()}
                >
                    <Eye size={20} absoluteStrokeWidth={true} />
                </Link>
            ) : (
                <Link
                    to="/m/$merchantId/campaigns/$campaignId"
                    params={{ merchantId, campaignId: row.original.id }}
                >
                    <Eye size={20} absoluteStrokeWidth={true} />
                </Link>
            )}
            {isDraft && (
                <Link
                    to="/m/$merchantId/campaigns/draft/$campaignId"
                    params={{ merchantId, campaignId: row.original.id }}
                    onClick={() => reset()}
                >
                    <Pencil size={20} absoluteStrokeWidth={true} />
                </Link>
            )}
            {!isDraft && !isArchived && (
                <Link
                    to="/m/$merchantId/campaigns/edit/$campaignId"
                    params={{ merchantId, campaignId: row.original.id }}
                    onClick={() => reset()}
                >
                    <Pencil size={20} absoluteStrokeWidth={true} />
                </Link>
            )}
            {actions.canPause && (
                <ModalPause
                    campaignId={row.original.id}
                    merchantId={row.original.merchantId}
                    campaignName={row.original.name}
                />
            )}
            {actions.canResume && (
                <ModalResume
                    campaignId={row.original.id}
                    merchantId={row.original.merchantId}
                    campaignName={row.original.name}
                />
            )}
            {actions.canArchive && (
                <ModalArchive
                    campaignId={row.original.id}
                    merchantId={row.original.merchantId}
                    campaignName={row.original.name}
                />
            )}
            {actions.canDelete && (
                <ModalDelete
                    campaignId={row.original.id}
                    merchantId={row.original.merchantId}
                    campaignName={row.original.name}
                />
            )}
        </div>
    );
}
