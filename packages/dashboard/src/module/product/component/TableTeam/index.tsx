import { getProductAdministrators } from "@/context/product/action/getAdministrators";
import { Badge } from "@/module/common/component/Badge";
import type { ReactTableProps } from "@/module/common/component/Table";
import { ButtonAddTeam } from "@/module/product/component/ButtonAddTeam";
import {
    DeleteTeamMemberModal,
    UpdateRoleTeamMemberModal,
} from "@/module/product/component/TableTeam/Modal";
import { useIsProductOwner } from "@/module/product/hook/useIsProductOwner";
import { permissionLabels } from "@/module/product/utils/permissions";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { Button } from "@module/component/Button";
import { WalletAddress } from "@module/component/HashDisplay";
import { Skeleton } from "@module/component/Skeleton";
import { Tooltip } from "@module/component/Tooltip";
import { useQuery } from "@tanstack/react-query";
import { type CellContext, createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { type Hex, isAddressEqual, toHex } from "viem";
import styles from "./index.module.css";

const Table = dynamic<ReactTableProps<ManageTeamTableData>>(
    () => import("@/module/common/component/Table").then((mod) => mod.Table),
    {
        loading: () => <Skeleton />,
    }
);

export type ManageTeamTableData = Awaited<
    ReturnType<typeof getProductAdministrators>
>[number] & { isMe: boolean };

const columnHelper = createColumnHelper<ManageTeamTableData>();

export function TableTeam({ productId }: { productId: Hex }) {
    const { data: walletStatus } = useWalletStatus();
    const { data: isProductOwner } = useIsProductOwner({ productId });

    const { data: administrators, isLoading } = useQuery({
        queryKey: ["product", "team", productId.toString(), walletStatus?.key],
        queryFn: async () => {
            console.log("productId", productId);
            const administrators = await getProductAdministrators({
                productId: toHex(BigInt(productId)),
            });
            if (walletStatus?.key !== "connected")
                return administrators.map((admin) => ({
                    ...admin,
                    isMe: false,
                }));
            return administrators.map((admin) => ({
                ...admin,
                isMe: isAddressEqual(admin.wallet, walletStatus.wallet),
            }));
        },
    });

    const columns = useMemo(
        () =>
            [
                columnHelper.accessor("wallet", {
                    enableSorting: false,
                    header: "Wallet",
                    cell: ({ getValue, row }) => (
                        <>
                            {row.original.isMe && "Me: "}
                            <WalletAddress wallet={getValue()} />
                        </>
                    ),
                }),
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
            ] as ColumnDef<ManageTeamTableData>[],
        [productId]
    );

    if (!administrators || isLoading) {
        return <Skeleton />;
    }

    return (
        <>
            <Table
                data={administrators}
                columns={columns}
                preTable={
                    isProductOwner && (
                        <ButtonAddTeam productId={productId}>
                            <Button variant={"submit"}>Add Team Member</Button>
                        </ButtonAddTeam>
                    )
                }
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
}: Pick<CellContext<ManageTeamTableData, unknown>, "row"> & {
    productId: Hex;
}) {
    const { data: isProductOwner } = useIsProductOwner({ productId });
    const { data: wallletStatus } = useWalletStatus();

    // Check if the user can do actions
    const { canDoActions, isSelfAction } = useMemo(() => {
        // If it's the admin role, disable permissions
        if (row.original.roleDetails.admin)
            return {
                canDoActions: false,
                isSelfAction: false,
            };

        // If we are the product owner, we can do everything
        if (isProductOwner)
            return {
                canDoActions: true,
                isSelfAction: false,
            };

        // Otherwise, check if the user is the current cell
        if (wallletStatus?.key !== "connected")
            return {
                canDoActions: false,
                isSelfAction: false,
            };

        const isCurrentUser = isAddressEqual(
            row.original.wallet,
            wallletStatus.wallet
        );
        return {
            canDoActions: isCurrentUser,
            isSelfAction: isCurrentUser,
        };
    }, [isProductOwner, row, wallletStatus]);

    // Directly exit if the user can't do actions
    if (!canDoActions) return null;

    // const actions = useMemo(() => row.original.actions, [row.original.actions]);
    return (
        <div className={styles.table__actions}>
            <UpdateRoleTeamMemberModal
                productId={productId}
                row={row}
                isRenouncing={isSelfAction}
            />
            <DeleteTeamMemberModal
                row={row}
                productId={productId}
                isRenouncing={isSelfAction}
            />
        </div>
    );
}

function PermissionsBadge({
    roleDetails,
}: { roleDetails: ManageTeamTableData["roleDetails"] }) {
    if (roleDetails.admin) {
        return <Badge variant={"success"}>Admin</Badge>;
    }

    const badges = [];

    if (roleDetails.productManager) {
        badges.push(
            <Tooltip
                content={permissionLabels.productManager.description}
                key={"productManager"}
            >
                <Badge variant={"warning"}>Product</Badge>
            </Tooltip>
        );
    }
    if (roleDetails.campaignManager) {
        badges.push(
            <Tooltip
                content={permissionLabels.campaignManager.description}
                key={"campaignManager"}
            >
                <Badge variant={"warning"}>Campaign</Badge>
            </Tooltip>
        );
    }
    return <span className={styles.table__badges}>{badges}</span>;
}
