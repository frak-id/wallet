"use client";

import { useDeleteCampaign } from "@/module/campaigns/hook/useDeleteCampaign";
import { useGetCampaigns } from "@/module/campaigns/hook/useGetCampaigns";
import { State } from "@/module/common/component/State";
import type { ReactTableProps } from "@/module/common/component/Table";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import type { CampaignWithState } from "@/types/Campaign";
import { Skeleton } from "@module/component/Skeleton";
import { type CellContext, createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { usePrevious } from "@uidotdev/usehooks";
import { Eye, Pencil, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { capitalize } from "radash";
import { useEffect, useMemo } from "react";
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
                    cell: ({ getValue }) => formatDate(new Date(getValue())),
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
                columns={columns}
                filtering={filtering}
                setFiltering={setFiltering}
                pagination={false}
            />
        )
    );
}

/**
 * Component representing the posible cell actions
 * @param row
 * @constructor
 */
function CellActions({
    row,
}: Pick<CellContext<CampaignWithState, unknown>, "row">) {
    const { mutate: onDeleteClick, isPending: isDeleting } =
        useDeleteCampaign();

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
            {actions.canDelete && (
                <button
                    type={"button"}
                    disabled={isDeleting}
                    onClick={() =>
                        onDeleteClick({ campaignId: row.original._id })
                    }
                >
                    <Trash2 size={20} absoluteStrokeWidth={true} />
                </button>
            )}
        </div>
    );
}
