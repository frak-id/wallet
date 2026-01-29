import { useWalletStatus } from "@frak-labs/react-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { WalletAddress } from "@frak-labs/ui/component/HashDisplay";
import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { type CellContext, createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { isAddressEqual, zeroAddress } from "viem";
import { Badge } from "@/module/common/component/Badge";
import { Table } from "@/module/common/component/Table";
import { useHasRoleOnMerchant } from "@/module/common/hook/useHasRoleOnMerchant";
import { ButtonAddTeam } from "@/module/merchant/component/ButtonAddTeam";
import { DeleteTeamMemberModal } from "@/module/merchant/component/TableTeam/Modal";
import {
    type MerchantAdministrator,
    useGetMerchantAdministrators,
} from "@/module/merchant/hook/useGetMerchantAdministrators";
import styles from "./index.module.css";

export type ManageTeamTableData = MerchantAdministrator;

const columnHelper = createColumnHelper<ManageTeamTableData>();

export function TableTeam({ merchantId }: { merchantId: string }) {
    const { isAdministrator } = useHasRoleOnMerchant({ merchantId });
    const { data: administrators, isLoading } = useGetMerchantAdministrators({
        merchantId,
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
                columnHelper.accessor("isOwner", {
                    enableSorting: false,
                    header: "Role",
                    cell: ({ getValue }) => (
                        <Badge variant={getValue() ? "success" : "warning"}>
                            {getValue() ? "Owner" : "Admin"}
                        </Badge>
                    ),
                }),
                columnHelper.display({
                    header: "Action",
                    cell: ({ row }) => (
                        <CellActions row={row} merchantId={merchantId} />
                    ),
                }),
            ] as ColumnDef<ManageTeamTableData>[],
        [merchantId]
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
                    <ButtonAddTeam merchantId={merchantId}>
                        <Button variant={"submit"}>Add Team Member</Button>
                    </ButtonAddTeam>
                )
            }
        />
    );
}

function CellActions({
    row,
    merchantId,
}: Pick<CellContext<ManageTeamTableData, unknown>, "row"> & {
    merchantId: string;
}) {
    const { data: wallletStatus } = useWalletStatus();
    const { isAdministrator } = useHasRoleOnMerchant({ merchantId });

    const canDoActions = useMemo(() => {
        if (row.original.isOwner) return false;
        if (isAdministrator) return true;

        return isAddressEqual(
            row.original.wallet,
            wallletStatus?.wallet ?? zeroAddress
        );
    }, [isAdministrator, row, wallletStatus]);

    if (!canDoActions) return null;

    return (
        <div className={styles.table__actions}>
            <DeleteTeamMemberModal row={row} merchantId={merchantId} />
        </div>
    );
}
