"use client";
import { Button } from "@frak-labs/ui/component/Button";
import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import {
    type CellContext,
    type ColumnFiltersState,
    createColumnHelper,
} from "@tanstack/react-table";
import { atom, useAtomValue } from "jotai";
import { useSetAtom } from "jotai/index";
import { Eye, Pencil, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { capitalize } from "radash";
import { useMemo, useState } from "react";
import { campaignResetAtom } from "@/module/campaigns/atoms/campaign";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { TableCampaignFilters } from "@/module/campaigns/component/TableCampaigns/Filter";
import { useDeleteCampaign } from "@/module/campaigns/hook/useDeleteCampaign";
import { useGetCampaigns } from "@/module/campaigns/hook/useGetCampaigns";
import { useUpdateCampaignRunningStatus } from "@/module/campaigns/hook/useUpdateCampaignRunningStatus";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import type { ReactTableProps } from "@/module/common/component/Table";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import { Switch } from "@/module/forms/Switch";
import type { CampaignWithState } from "@/types/Campaign";
import styles from "./index.module.css";

const Table = dynamic<ReactTableProps<CampaignWithState>>(
    () => import("@/module/common/component/Table").then((mod) => mod.Table),
    {
        loading: () => <Skeleton />,
    }
);

const columnHelper = createColumnHelper<CampaignWithState>();

export const tableCampaignFiltersAtom = atom<ColumnFiltersState>([]);

export function TableCampaigns() {
    const { data, isLoading } = useGetCampaigns();
    const {
        mutate: onUpdateCampaignRunningStatus,
        isPending: isUpdatingCampaignState,
    } = useUpdateCampaignRunningStatus();
    const columnFilters = useAtomValue(tableCampaignFiltersAtom);

    const columns = useMemo(
        () =>
            [
                columnHelper.accessor("state", {
                    enableSorting: false,
                    header: "On/Off",
                    id: "state-running",
                    cell: ({ getValue, row }) => {
                        const state = getValue();
                        const isCreated = state.key === "created";
                        return (
                            <Switch
                                checked={isCreated && state.isRunning}
                                disabled={
                                    !isCreated ||
                                    isUpdatingCampaignState ||
                                    !row.original.actions.canToggleRunningStatus
                                }
                                onCheckedChange={() => {
                                    if (!isCreated || isUpdatingCampaignState)
                                        return;
                                    onUpdateCampaignRunningStatus({
                                        campaign: state.address,
                                        newRunningStatus: !state.isRunning,
                                    });
                                }}
                            />
                        );
                    },
                }),
                columnHelper.accessor("title", {
                    enableSorting: false,
                    header: () => "Campaign",
                    cell: ({ getValue, row }) => (
                        <Link href={`/campaigns/${row.original._id}`}>
                            {getValue()}
                        </Link>
                    ),
                }),
                columnHelper.accessor("state", {
                    enableSorting: true,
                    header: () => "Status",
                    id: "state",
                    cell: ({ getValue }) => (
                        <CampaignStateTag state={getValue()} />
                    ),
                }),
                {
                    id: "date",
                    header: () => "Date",
                    accessorFn: (row) =>
                        row?.scheduled?.dateStart &&
                        formatDate(new Date(row.scheduled.dateStart)),
                    filterFn: (row, _, value) =>
                        row?.original?.scheduled?.dateStart &&
                        new Date(row.original.scheduled.dateStart).getDate() >
                            new Date(value).getDate(),
                },
                columnHelper.accessor("budget.maxEuroDaily", {
                    header: () => "Budget",
                    cell: ({ row, getValue }) => (
                        <CellBudget row={row} getValue={getValue} />
                    ),
                }),
                columnHelper.display({
                    header: "Action",
                    cell: ({ row }) => <CellActions row={row} />,
                }),
            ] as ColumnDef<CampaignWithState>[],
        [onUpdateCampaignRunningStatus, isUpdatingCampaignState]
    );

    if (!data || isLoading) {
        return <Skeleton />;
    }

    return (
        data && (
            <>
                <TableCampaignFilters />
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

/**
 * todo: we need to review the campaign object for a better support of each currencies
 */
function CellBudget({
    row,
    getValue,
}: Pick<CellContext<CampaignWithState, undefined>, "row" | "getValue">) {
    // const { bankInfo } = useGetBankInfo({ bank: row.original.bank });
    // const converted = useConvertToPreferredCurrency({
    //     amount: getValue(),
    //     token: bankInfo?.token,
    // });

    // if (!converted) return <Spinner />;

    return (
        <span className={styles.table__budget}>
            <span className={styles.table__budgetAmount}>
                {formatPrice(getValue(), undefined, "EUR")}
            </span>
            {row.original.budget?.type && (
                <span className={styles.table__budgetType}>
                    {capitalize(row.original.budget.type)}
                </span>
            )}
        </span>
    );
}

/**
 * Component representing the possible cell actions
 * @param row
 * @constructor
 */
function CellActions({
    row,
}: Pick<CellContext<CampaignWithState, unknown>, "row">) {
    const actions = useMemo(() => row.original.actions, [row.original.actions]);
    const router = useRouter();
    const campaignReset = useSetAtom(campaignResetAtom);

    return (
        <div className={styles.table__actions}>
            <button
                type={"button"}
                onClick={() => router.push(`/campaigns/${row.original._id}`)}
            >
                <Eye size={20} absoluteStrokeWidth={true} />
            </button>
            {actions.canEdit && (
                <button
                    type={"button"}
                    onClick={() => {
                        campaignReset();
                        const action =
                            row.original.state.key === "draft"
                                ? "draft"
                                : "edit";
                        router.push(`/campaigns/${action}/${row.original._id}`);
                    }}
                >
                    <Pencil size={20} absoluteStrokeWidth={true} />
                </button>
            )}
            {actions.canDelete && <ModalDelete row={row} />}
        </div>
    );
}

/**
 * Component representing the delete modal
 * @param row
 * @constructor
 */
function ModalDelete({
    row,
}: Pick<CellContext<CampaignWithState, unknown>, "row">) {
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
                    <strong>{row.original.title}</strong>?
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
                            campaignId: row.original._id,
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
