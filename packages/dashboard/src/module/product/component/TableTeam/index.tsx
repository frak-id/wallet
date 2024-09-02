import { getProductAdministrators } from "@/context/product/action/getAdministrators";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Badge } from "@/module/common/component/Badge";
import type { ReactTableProps } from "@/module/common/component/Table";
import { ButtonAddTeam } from "@/module/product/component/ButtonAddTeam";
import { useIsProductOwner } from "@/module/product/hook/useIsProductOwner";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { Button } from "@module/component/Button";
import { Skeleton } from "@module/component/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { type CellContext, createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { isAddressEqual, toHex } from "viem";
import styles from "./index.module.css";

const Table = dynamic<ReactTableProps<TableData, TableMetas>>(
    () => import("@/module/common/component/Table").then((mod) => mod.Table),
    {
        loading: () => <Skeleton />,
    }
);

type TableData = Awaited<ReturnType<typeof getProductAdministrators>>[number];

type TableMetas = {
    page: number;
    limit: number;
};

const columnHelper = createColumnHelper<TableData>();

export function TableTeam({ productId }: { productId: bigint }) {
    const { data: administrators, isLoading } = useQuery({
        queryKey: ["product", "team", productId.toString()],
        queryFn: () =>
            getProductAdministrators({ productId: toHex(productId) }),
    });

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
                columnHelper.accessor("roleDetails", {
                    enableSorting: false,
                    header: "Permission",
                    cell: ({ getValue }) => (
                        <PermissionsBadge roleDetails={getValue()} />
                    ),
                }),
                columnHelper.display({
                    header: "Action",
                    cell: ({ row }) => (
                        <CellActions row={row} productId={productId} />
                    ),
                }),
            ] as ColumnDef<TableData>[],
        [productId]
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
                pagination={false}
                preTable={<ButtonAddTeam productId={productId} />}
            />
        </>
    );
}

/**
 * Component representing the possible cell actions
 * @param row
 * @param productId
 * @constructor
 */
function CellActions({
    row,
    productId,
}: Pick<CellContext<TableData, unknown>, "row"> & { productId: bigint }) {
    const { data: isProductOwner } = useIsProductOwner({ productId });
    const { data: wallletStatus } = useWalletStatus();

    // Check if the user can do actions
    const canDoActions = useMemo(() => {
        if (isProductOwner) return true;

        // Otherwise, check if the user is the current cell
        if (!wallletStatus) return false;
        if (wallletStatus?.key !== "connected") return false;
        return isAddressEqual(row.original.wallet, wallletStatus.wallet);
    }, [isProductOwner, row, wallletStatus]);

    // Directly exit if the user can't do actions
    if (!canDoActions) return null;

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

function PermissionsBadge({
    roleDetails,
}: { roleDetails: TableData["roleDetails"] }) {
    if (roleDetails.admin) {
        return <Badge variant={"success"}>Admin</Badge>;
    }

    const badges = [];

    if (roleDetails.productManager) {
        badges.push(<Badge variant={"warning"}>Product</Badge>);
    }
    if (roleDetails.campaignManager) {
        badges.push(<Badge variant={"warning"}>Campaign</Badge>);
    }
    return <>{badges}</>;
}
