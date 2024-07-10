"use client";

import { useDeleteCampaign } from "@/module/campaigns/hook/useDeleteCampaign";
import { useGetCampaigns } from "@/module/campaigns/hook/useGetCampaigns";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { State } from "@/module/common/component/State";
import type { ReactTableProps } from "@/module/common/component/Table";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import type { CampaignWithState } from "@/types/Campaign";
import { Button } from "@module/component/Button";
import { Skeleton } from "@module/component/Skeleton";
import { type CellContext, createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { usePrevious } from "@uidotdev/usehooks";
import { Eye, Pencil, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { capitalize } from "radash";
import { useEffect, useMemo, useState } from "react";
import useSessionStorageState from "use-session-storage-state";
import styles from "./index.module.css";

const Table = dynamic<ReactTableProps<CampaignWithState, TableMetas>>(
    () => import("@/module/common/component/Table").then((mod) => mod.Table),
    {
        loading: () => <Skeleton />,
    }
);

type TableMetas = {
    page: number;
    limit: number;
    firstPage: string;
    lastPage: string;
    nextPage: string;
    previousPage: string;
    totalPages: number;
    totalResults: number;
};

const columnHelper = createColumnHelper<CampaignWithState>();

const initialFilteringState = { page: 1 };

export function TableCampaigns() {
    const { data, isLoading } = useGetCampaigns();
    const [localTitle] = useSessionStorageState("title-autocomplete", {
        defaultValue: "",
    });
    const [filtering, setFiltering] = useSessionStorageState(
        "table-filtering",
        {
            defaultValue: initialFilteringState,
        }
    );
    const previousTitle = usePrevious(localTitle);

    useEffect(() => {
        if (previousTitle === undefined) {
            return;
        }
        if (localTitle !== previousTitle) {
            setFiltering(initialFilteringState);
        }
    }, [localTitle, previousTitle, setFiltering]);

    const columns = useMemo(
        () =>
            [
                /*columnHelper.display({
                    id: "checkbox",
                    header: ({ table }) => (
                        <Checkbox
                            {...{
                                checked: table.getIsSomeRowsSelected()
                                    ? "indeterminate"
                                    : table.getIsAllPageRowsSelected(),
                                onCheckedChange: (checked) => {
                                    if (checked !== "indeterminate") {
                                        table.toggleAllPageRowsSelected(
                                            checked
                                        );
                                    }
                                },
                            }}
                        />
                    ),
                    cell: ({ row }) => (
                        <Checkbox
                            {...{
                                checked: row.getIsSelected() ?? "indeterminate",
                                disabled: !row.getCanSelect(),
                                onCheckedChange: (checked) => {
                                    if (checked !== "indeterminate") {
                                        row.toggleSelected(checked);
                                    }
                                },
                            }}
                        />
                    ),
                }),*/
                /*columnHelper.accessor("enabled", {
                    header: "On/Off",
                    cell: ({ getValue }) => {
                        return (
                            <Switch
                                checked={getValue()}
                                onCheckedChange={(value) => console.log(value)}
                            />
                        );
                    },
                }),*/
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
                    enableSorting: false,
                    header: () => "Status",
                    cell: ({ getValue }) => <State state={getValue()} />,
                }),
                columnHelper.accessor("scheduled.dateStart", {
                    enableSorting: false,
                    header: () => "Date",
                    cell: ({ getValue }) =>
                        getValue() && formatDate(new Date(getValue())),
                }),
                columnHelper.accessor("budget.maxEuroDaily", {
                    enableSorting: false,
                    header: () => "Budget",
                    cell: ({ getValue, row }) => {
                        return (
                            <span className={styles.table__budget}>
                                <span className={styles.table__budgetAmount}>
                                    {formatPrice(getValue())}
                                </span>
                                <span className={styles.table__budgetType}>
                                    {capitalize(row.original.budget.type)}
                                </span>
                            </span>
                        );
                    },
                }),
                columnHelper.display({
                    header: "Action",
                    cell: ({ row }) => <CellActions row={row} />,
                }),
            ] as ColumnDef<CampaignWithState>[],
        []
    );

    if (!data || isLoading) {
        return <Skeleton />;
    }

    return (
        data && (
            <Table
                data={data}
                limit={data.length}
                columns={columns}
                filtering={filtering}
                setFiltering={setFiltering}
                pagination={false}
            />
        )
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

    return (
        <div className={styles.table__actions}>
            <button type={"button"} onClick={() => console.log("View")}>
                <Eye size={20} absoluteStrokeWidth={true} />
            </button>
            {actions.canEdit && (
                <button type={"button"} onClick={() => console.log("Edit")}>
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
