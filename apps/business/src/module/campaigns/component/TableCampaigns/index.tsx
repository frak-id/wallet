import { Button } from "@frak-labs/ui/component/Button";
import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
    type CellContext,
    type ColumnFiltersState,
    createColumnHelper,
} from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { TableCampaignFilters } from "@/module/campaigns/component/TableCampaigns/Filter";
import { useDeleteCampaign } from "@/module/campaigns/hook/useDeleteCampaign";
import { useGetCampaigns } from "@/module/campaigns/hook/useGetCampaigns";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Table } from "@/module/common/component/Table";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { campaignStore } from "@/stores/campaignStore";
import type { CampaignWithActions } from "@/types/Campaign";
import styles from "./index.module.css";

const columnHelper = createColumnHelper<CampaignWithActions>();

export function TableCampaigns() {
    const { data } = useGetCampaigns();
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    const columns = useMemo(
        () =>
            [
                columnHelper.accessor("name", {
                    enableSorting: false,
                    header: () => "Campaign",
                    cell: ({ getValue, row }) => (
                        <Link
                            to="/campaigns/$campaignId"
                            params={{ campaignId: row.original.id }}
                        >
                            {getValue()}
                        </Link>
                    ),
                }),
                columnHelper.accessor("status", {
                    enableSorting: true,
                    header: () => "Status",
                    id: "status",
                    cell: ({ getValue }) => (
                        <CampaignStateTag status={getValue()} />
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
                    cell: ({ row }) => <CellActions row={row} />,
                }),
            ] as ColumnDef<CampaignWithActions>[],
        []
    );

    if (!data) {
        return <Skeleton />;
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
    const firstBudget = budgetConfig?.[0];

    if (!firstBudget) {
        return <span className={styles.table__budget}>-</span>;
    }

    return (
        <span className={styles.table__budget}>
            <span className={styles.table__budgetAmount}>
                {formatPrice(firstBudget.amount, undefined, "EUR")}
            </span>
            <span className={styles.table__budgetType}>
                {firstBudget.label || "Daily"}
            </span>
        </span>
    );
}

function CellActions({
    row,
}: Pick<CellContext<CampaignWithActions, unknown>, "row">) {
    const actions = useMemo(() => row.original.actions, [row.original.actions]);
    const reset = campaignStore((state) => state.reset);

    return (
        <div className={styles.table__actions}>
            <Link
                to="/campaigns/$campaignId"
                params={{ campaignId: row.original.id }}
            >
                <Eye size={20} absoluteStrokeWidth={true} />
            </Link>
            {actions.canEdit && (
                <Link
                    to="/campaigns/edit/$campaignId"
                    params={{ campaignId: row.original.id }}
                    onClick={() => reset()}
                >
                    <Pencil size={20} absoluteStrokeWidth={true} />
                </Link>
            )}
            {actions.canDelete && <ModalDelete row={row} />}
        </div>
    );
}

function ModalDelete({
    row,
}: Pick<CellContext<CampaignWithActions, unknown>, "row">) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onDeleteClick,
        isPending: isDeleting,
        isError,
    } = useDeleteCampaign();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Delete campaign"}
            buttonElement={
                <button type={"button"}>
                    <Trash2 size={20} absoluteStrokeWidth={true} />
                </button>
            }
            description={
                <>
                    Are you sure you want to delete the campaign{" "}
                    <strong>{row.original.name}</strong>?
                </>
            }
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"outline"}>Cancel</Button>}
            action={
                <Button
                    variant={"danger"}
                    isLoading={isDeleting}
                    disabled={isDeleting}
                    onClick={async () => {
                        await onDeleteClick({
                            campaignId: row.original.id,
                            merchantId: row.original.merchantId,
                        });
                        setOpen(false);
                    }}
                >
                    Delete
                </Button>
            }
        />
    );
}
