import { useWalletStatus } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { WalletAddress } from "@frak-labs/ui/component/HashDisplay";
import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import { Tooltip } from "@frak-labs/ui/component/Tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { type CellContext, createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { type Hex, isAddressEqual, zeroAddress } from "viem";
import type { getProductAdministrators } from "@/context/product/action/getAdministrators";
import { Badge } from "@/module/common/component/Badge";
import { Table } from "@/module/common/component/Table";
import { useHasRoleOnProduct } from "@/module/common/hook/useHasRoleOnProduct";
import { ButtonAddTeam } from "@/module/product/component/ButtonAddTeam";
import {
    DeleteTeamMemberModal,
    UpdateRoleTeamMemberModal,
} from "@/module/product/component/TableTeam/Modal";
import { useGetProductAdministrators } from "@/module/product/hook/useGetProductAdministrators";
import { permissionLabels } from "@/module/product/utils/permissions";
import styles from "./index.module.css";

export type ManageTeamTableData = Awaited<
    ReturnType<typeof getProductAdministrators>
>[number] & { isMe: boolean };

const columnHelper = createColumnHelper<ManageTeamTableData>();

export function TableTeam({ productId }: { productId: Hex }) {
    const { isAdministrator } = useHasRoleOnProduct({ productId });
    const { data: administrators, isLoading } = useGetProductAdministrators({
        productId,
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
        <Table
            data={administrators}
            columns={columns}
            preTable={
                isAdministrator && (
                    <ButtonAddTeam productId={productId}>
                        <Button variant={"submit"}>Add Team Member</Button>
                    </ButtonAddTeam>
                )
            }
        />
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
    const { data: wallletStatus } = useWalletStatus();
    const { isAdministrator } = useHasRoleOnProduct({ productId });

    // Check if the user can do actions
    const { canDoActions, isSelfAction } = useMemo(() => {
        // If it's the admin role, disable permissions
        if (row.original.isOwner)
            return {
                canDoActions: false,
                isSelfAction: false,
            };

        // If we are the product admin, we can do everything
        if (isAdministrator)
            return {
                canDoActions: true,
                isSelfAction: false,
            };

        // Otherwise, check if the user is the current cell
        const isCurrentUser = isAddressEqual(
            row.original.wallet,
            wallletStatus?.wallet ?? zeroAddress
        );
        return {
            canDoActions: isCurrentUser,
            isSelfAction: isCurrentUser,
        };
    }, [isAdministrator, row, wallletStatus]);

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
}: {
    roleDetails: ManageTeamTableData["roleDetails"];
}) {
    if (roleDetails.admin) {
        return <Badge variant={"success"}>Owner</Badge>;
    }

    const badges = [];

    for (const [role, value] of Object.entries(roleDetails)) {
        const info = permissionLabels[role as keyof typeof permissionLabels];
        if (role === "admin" || !value || !info) continue;
        badges.push(
            <Tooltip content={info.description} key={role}>
                <Badge variant={info.color ?? "warning"}>
                    {info.shortLabel}
                </Badge>
            </Tooltip>
        );
    }
    return <span className={styles.table__badges}>{badges}</span>;
}
