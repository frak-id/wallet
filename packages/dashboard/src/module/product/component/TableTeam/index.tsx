import { getContentAdministrators } from "@/context/content/action/getAdministrators";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Badge } from "@/module/common/component/Badge";
import type { ReactTableProps } from "@/module/common/component/Table";
import { ButtonAddTeam } from "@/module/product/component/ButtonAddTeam";
import { Button } from "@module/component/Button";
import { Skeleton } from "@module/component/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { type CellContext, createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { usePrevious } from "@uidotdev/usehooks";
import { Pencil, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import useSessionStorageState from "use-session-storage-state";
import { toHex } from "viem";
import styles from "./index.module.css";

const Table = dynamic<ReactTableProps<TableData, TableMetas>>(
    () => import("@/module/common/component/Table").then((mod) => mod.Table),
    {
        loading: () => <Skeleton />,
    }
);

type TableData = Awaited<ReturnType<typeof getContentAdministrators>>[number];

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

const columnHelper = createColumnHelper<TableData>();

const initialFilteringState = { page: 1 };

export function TableTeam({ productId }: { productId: bigint }) {
    const { data: administrators, isLoading } = useQuery({
        queryKey: ["product", "team", productId.toString()],
        queryFn: () =>
            getContentAdministrators({ contentId: toHex(productId) }),
    });

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
                columnHelper.accessor("wallet", {
                    enableSorting: false,
                    header: "Wallet",
                    cell: ({ getValue }) => (
                        <Button
                            variant={"ghost"}
                            className={styles.table__buttonWallet}
                        >
                            {getValue()}
                        </Button>
                    ),
                }),
                /*columnHelper.display({
                    header: "Member",
                    cell: "John Doe",
                }),*/
                columnHelper.accessor("isContentOwner", {
                    enableSorting: false,
                    header: "Permission",
                    cell: ({ getValue }) => (
                        <Badge variant={getValue() ? "success" : "warning"}>
                            {getValue() ? "Admin" : "Operator"}
                        </Badge>
                    ),
                }),
                columnHelper.display({
                    header: "Action",
                    cell: ({ row }) => <CellActions row={row} />,
                }),
            ] as ColumnDef<TableData>[],
        []
    );

    if (!administrators || isLoading) {
        return <Skeleton />;
    }

    return (
        <>
            <Table
                data={administrators}
                limit={administrators.length}
                columns={columns}
                filtering={filtering}
                setFiltering={setFiltering}
                pagination={false}
                preTable={<ButtonAddTeam />}
            />
        </>
    );
}

/**
 * Component representing the possible cell actions
 * @param row
 * @constructor
 */
function CellActions({ row }: Pick<CellContext<TableData, unknown>, "row">) {
    // const actions = useMemo(() => row.original.actions, [row.original.actions]);
    return (
        <div className={styles.table__actions}>
            <button type={"button"}>
                <Pencil size={20} absoluteStrokeWidth={true} />
            </button>
            <ModalDelete row={row} />
        </div>
    );
}

/**
 * Component representing the delete modal
 * @param row
 * @constructor
 */
function ModalDelete({ row }: Pick<CellContext<TableData, unknown>, "row">) {
    const [open, setOpen] = useState(false);
    // const {
    //     mutateAsync: onDeleteClick,
    //     isPending: isDeleting,
    //     isError,
    // } = useDeleteCampaign();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Delete member"}
            buttonElement={
                <button type={"button"}>
                    <Trash2 size={20} absoluteStrokeWidth={true} />
                </button>
            }
            description={
                <>
                    Are you sure you want to delete the user{" "}
                    <strong>{row.original.wallet}</strong>?
                </>
            }
            /*text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }*/
            cancel={<Button variant={"outline"}>Cancel</Button>}
            action={
                <Button
                    variant={"danger"}
                    // isLoading={isDeleting}
                    // disabled={isDeleting}
                    onClick={async () => {
                        // await onDeleteClick({
                        //     campaignId: row.original._id,
                        // });
                        setOpen(false);
                    }}
                >
                    Delete
                </Button>
            }
        />
    );
}
