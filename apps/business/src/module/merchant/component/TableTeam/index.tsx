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
import { Text } from "@frak-labs/design-system/components/Text";
import { DeleteIcon, SendIcon } from "@frak-labs/design-system/icons";
import { useWalletStatus } from "@frak-labs/react-sdk";
import { Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isAddressEqual, zeroAddress } from "viem";
import { WalletAddress } from "@/module/common/component/HashDisplay";
import { useHasRoleOnMerchant } from "@/module/common/hook/useHasRoleOnMerchant";
import { useAdminMutation } from "@/module/merchant/hook/useAdminMutation";
import {
    type MerchantAdministrator,
    useGetMerchantAdministrators,
} from "@/module/merchant/hook/useGetMerchantAdministrators";
import * as styles from "./table-team.css";

type Props = {
    merchantId: string;
    stagedRemovals: string[];
    onToggleRemoval: (adminId: string) => void;
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
                            key={admin.id}
                            merchantId={merchantId}
                            admin={admin}
                            hasAccess={hasAccess}
                            isStaged={stagedRemovals.includes(admin.id)}
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
    merchantId,
    admin,
    hasAccess,
    isStaged,
    onToggleRemoval,
    disabled,
}: {
    merchantId: string;
    admin: MerchantAdministrator;
    hasAccess: boolean;
    isStaged: boolean;
    onToggleRemoval: (adminId: string) => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();
    const { data: walletStatus } = useWalletStatus();
    const { mutate: resendInvite, isPending: isResending } = useAdminMutation({
        action: "add",
    });
    const [resendState, setResendState] = useState<
        "idle" | "success" | "error"
    >("idle");

    const canRemove = useMemo(() => {
        if (admin.isOwner) return false;
        // Removal is now row-id-keyed (DELETE /:adminId, §2.7), so
        // walletless admins are removable too — a full-access caller can
        // remove anyone, otherwise only the admin's own row (self-removal).
        if (hasAccess) return true;
        if (admin.wallet !== null) {
            return isAddressEqual(
                admin.wallet,
                walletStatus?.wallet ?? zeroAddress
            );
        }
        return admin.isMe;
    }, [admin, hasAccess, walletStatus]);

    // Resend just re-runs the add mutation with the same email — the
    // backend's credential-less branch is idempotent (mints a fresh token
    // and resends the invitation email), so no separate endpoint is needed.
    const canResend = admin.status === "invited" && hasAccess && admin.email;

    return (
        <TableRow className={isStaged ? styles.rowStaged : undefined}>
            <TableCell>
                {admin.isMe && `${t("merchantEdit.team.me")} `}
                {admin.wallet ? (
                    <WalletAddress wallet={admin.wallet} />
                ) : (
                    (admin.email ?? t("merchantEdit.team.walletlessMember"))
                )}
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
                {admin.status === "invited" && (
                    <Badge size="small" variant="info">
                        {t("merchantEdit.team.invited")}
                    </Badge>
                )}
            </TableCell>
            <TableCell align="right" hug>
                {canResend && (
                    <button
                        type="button"
                        className={styles.iconButton}
                        disabled={disabled || isResending}
                        aria-label={t("merchantEdit.team.resendInvite")}
                        title={t("merchantEdit.team.resendInvite")}
                        onClick={() => {
                            const email = admin.email;
                            if (!email) return;
                            setResendState("idle");
                            resendInvite(
                                { merchantId, email },
                                {
                                    onSuccess: () => setResendState("success"),
                                    onError: () => setResendState("error"),
                                }
                            );
                        }}
                    >
                        <SendIcon width={20} height={20} />
                    </button>
                )}
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
                        onClick={() => onToggleRemoval(admin.id)}
                    >
                        {isStaged ? (
                            <Undo2 size={24} />
                        ) : (
                            <DeleteIcon width={24} height={24} />
                        )}
                    </button>
                )}
                {resendState === "success" && (
                    <Text variant="caption" color="secondary">
                        {t("merchantEdit.team.resendSuccess", {
                            email: admin.email ?? "",
                        })}
                    </Text>
                )}
                {resendState === "error" && (
                    <Text variant="caption" color="error">
                        {t("merchantEdit.team.resendError")}
                    </Text>
                )}
            </TableCell>
        </TableRow>
    );
}
