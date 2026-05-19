import { Stack } from "@frak-labs/design-system/components/Stack";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
    type CellContext,
    type ColumnFiltersState,
    createColumnHelper,
} from "@tanstack/react-table";
import { Archive, Eye, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { TableCampaignFilters } from "@/module/campaigns/component/TableCampaigns/Filter";
import { useDeleteCampaign } from "@/module/campaigns/hook/useDeleteCampaign";
import { useGetCampaigns } from "@/module/campaigns/hook/useGetCampaigns";
import { useStatusTransition } from "@/module/campaigns/hook/useStatusTransition";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@/module/common/component/Button";
import { Skeleton } from "@/module/common/component/Skeleton";
import { Table } from "@/module/common/component/Table";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { campaignStore } from "@/stores/campaignStore";
import type { CampaignWithActions } from "@/types/Campaign";
import * as styles from "./table-campaigns.css";

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
                    cell: ({ getValue, row }) => {
                        const isDraft = row.original.status === "draft";
                        const name = getValue() as string;
                        return isDraft ? (
                            <Link
                                to="/campaigns/draft/$campaignId"
                                params={{ campaignId: row.original.id }}
                            >
                                {name}
                            </Link>
                        ) : (
                            <Link
                                to="/campaigns/$campaignId"
                                params={{ campaignId: row.original.id }}
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
}: Pick<CellContext<CampaignWithActions, unknown>, "row">) {
    const actions = useMemo(() => row.original.actions, [row.original.actions]);
    const reset = campaignStore((state) => state.reset);
    const status = row.original.status;
    const isDraft = status === "draft";
    const isArchived = status === "archived";

    return (
        <div className={styles.tableActions}>
            {isDraft ? (
                <Link
                    to="/campaigns/draft/$campaignId"
                    params={{ campaignId: row.original.id }}
                    onClick={() => reset()}
                >
                    <Eye size={20} absoluteStrokeWidth={true} />
                </Link>
            ) : (
                <Link
                    to="/campaigns/$campaignId"
                    params={{ campaignId: row.original.id }}
                >
                    <Eye size={20} absoluteStrokeWidth={true} />
                </Link>
            )}
            {isDraft && (
                <Link
                    to="/campaigns/draft/$campaignId"
                    params={{ campaignId: row.original.id }}
                    onClick={() => reset()}
                >
                    <Pencil size={20} absoluteStrokeWidth={true} />
                </Link>
            )}
            {!isDraft && !isArchived && (
                <Link
                    to="/campaigns/edit/$campaignId"
                    params={{ campaignId: row.original.id }}
                    onClick={() => reset()}
                >
                    <Pencil size={20} absoluteStrokeWidth={true} />
                </Link>
            )}
            {actions.canPause && <ModalPause row={row} />}
            {actions.canResume && <ModalResume row={row} />}
            {actions.canArchive && <ModalArchive row={row} />}
            {actions.canDelete && <ModalDelete row={row} />}
        </div>
    );
}

function ModalPause({
    row,
}: Pick<CellContext<CampaignWithActions, unknown>, "row">) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onPauseClick,
        isPending: isPausing,
        isError,
    } = useStatusTransition();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Pause campaign"}
            buttonElement={
                <button type={"button"}>
                    <Pause size={20} absoluteStrokeWidth={true} />
                </button>
            }
            description={
                <>
                    Are you sure you want to pause the campaign{" "}
                    <strong>{row.original.name}</strong>?
                </>
            }
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"secondary"}>Cancel</Button>}
            action={
                <Button
                    variant={"secondary"}
                    loading={isPausing}
                    disabled={isPausing}
                    onClick={async () => {
                        await onPauseClick({
                            campaignId: row.original.id,
                            merchantId: row.original.merchantId,
                            action: "pause",
                        });
                        setOpen(false);
                    }}
                >
                    Pause
                </Button>
            }
        />
    );
}

function ModalResume({
    row,
}: Pick<CellContext<CampaignWithActions, unknown>, "row">) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onResumeClick,
        isPending: isResuming,
        isError,
    } = useStatusTransition();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Resume campaign"}
            buttonElement={
                <button type={"button"}>
                    <Play size={20} absoluteStrokeWidth={true} />
                </button>
            }
            description={
                <>
                    Are you sure you want to resume the campaign{" "}
                    <strong>{row.original.name}</strong>?
                </>
            }
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"secondary"}>Cancel</Button>}
            action={
                <Button
                    variant={"primary"}
                    loading={isResuming}
                    disabled={isResuming}
                    onClick={async () => {
                        await onResumeClick({
                            campaignId: row.original.id,
                            merchantId: row.original.merchantId,
                            action: "resume",
                        });
                        setOpen(false);
                    }}
                >
                    Resume
                </Button>
            }
        />
    );
}

function ModalArchive({
    row,
}: Pick<CellContext<CampaignWithActions, unknown>, "row">) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onArchiveClick,
        isPending: isArchiving,
        isError,
    } = useStatusTransition();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Archive campaign"}
            buttonElement={
                <button type={"button"}>
                    <Archive size={20} absoluteStrokeWidth={true} />
                </button>
            }
            description={
                <>
                    Are you sure you want to archive the campaign{" "}
                    <strong>{row.original.name}</strong>?
                </>
            }
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"secondary"}>Cancel</Button>}
            action={
                <Button
                    variant={"secondary"}
                    loading={isArchiving}
                    disabled={isArchiving}
                    onClick={async () => {
                        await onArchiveClick({
                            campaignId: row.original.id,
                            merchantId: row.original.merchantId,
                            action: "archive",
                        });
                        setOpen(false);
                    }}
                >
                    Archive
                </Button>
            }
        />
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
            cancel={<Button variant={"secondary"}>Cancel</Button>}
            action={
                <Button
                    variant={"destructive"}
                    loading={isDeleting}
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
