import { Badge } from "@frak-labs/design-system/components/Badge";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@frak-labs/design-system/components/Table";
import { DeleteIcon } from "@frak-labs/design-system/icons";
import { useWalletStatus } from "@frak-labs/react-sdk";
import { Undo2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { isAddressEqual, zeroAddress } from "viem";
import { WalletAddress } from "@/module/common/component/HashDisplay";
import { useHasRoleOnMerchant } from "@/module/common/hook/useHasRoleOnMerchant";
import {
    type MerchantAdministrator,
    useGetMerchantAdministrators,
} from "@/module/merchant/hook/useGetMerchantAdministrators";
import * as styles from "./table-team.css";

type Props = {
    merchantId: string;
    stagedRemovals: Address[];
    onToggleRemoval: (wallet: Address) => void;
    /** Lock the row actions while a save is running. */
    disabled?: boolean;
};

export function TableTeam({
    merchantId,
    stagedRemovals,
    onToggleRemoval,
    disabled,
}: Props) {
    const { t } = useTranslation();
    const { hasAccess } = useHasRoleOnMerchant({ merchantId });
    const { data: administrators, isLoading } = useGetMerchantAdministrators({
        merchantId,
    });

    if (!administrators || isLoading) {
        return <Skeleton variant="rect" height={160} />;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>
                        {t("merchantEdit.team.headers.wallet")}
                    </TableHead>
                    <TableHead hug>
                        {t("merchantEdit.team.headers.role")}
                    </TableHead>
                    <TableHead hug>
                        {t("merchantEdit.team.headers.action")}
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {administrators.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={3} align="center" muted>
                            {t("common.table.empty")}
                        </TableCell>
                    </TableRow>
                ) : (
                    administrators.map((admin) => (
                        <AdminRow
                            key={admin.wallet}
                            admin={admin}
                            hasAccess={hasAccess}
                            isStaged={stagedRemovals.some((a) =>
                                isAddressEqual(a, admin.wallet)
                            )}
                            onToggleRemoval={onToggleRemoval}
                            disabled={disabled}
                        />
                    ))
                )}
            </TableBody>
        </Table>
    );
}

function AdminRow({
    admin,
    hasAccess,
    isStaged,
    onToggleRemoval,
    disabled,
}: {
    admin: MerchantAdministrator;
    hasAccess: boolean;
    isStaged: boolean;
    onToggleRemoval: (wallet: Address) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();
    const { data: walletStatus } = useWalletStatus();

    const canRemove = useMemo(() => {
        if (admin.isOwner) return false;
        if (hasAccess) return true;
        return isAddressEqual(
            admin.wallet,
            walletStatus?.wallet ?? zeroAddress
        );
    }, [admin, hasAccess, walletStatus]);

    return (
        <TableRow className={isStaged ? styles.rowStaged : undefined}>
            <TableCell>
                {admin.isMe && `${t("merchantEdit.team.me")} `}
                <WalletAddress wallet={admin.wallet} />
            </TableCell>
            <TableCell align="right" hug>
                <Badge
                    size="small"
                    variant={admin.isOwner ? "success" : "warning"}
                >
                    {admin.isOwner
                        ? t("merchantEdit.team.roles.owner")
                        : t("merchantEdit.team.roles.admin")}
                </Badge>
            </TableCell>
            <TableCell align="right" hug>
                {canRemove && (
                    <button
                        type="button"
                        className={styles.iconButton}
                        disabled={disabled}
                        aria-label={
                            isStaged
                                ? t("merchantEdit.team.undoRemove")
                                : t("merchantEdit.team.removeMember")
                        }
                        onClick={() => onToggleRemoval(admin.wallet)}
                    >
                        {isStaged ? (
                            <Undo2 size={24} />
                        ) : (
                            <DeleteIcon width={24} height={24} />
                        )}
                    </button>
                )}
            </TableCell>
        </TableRow>
    );
}
