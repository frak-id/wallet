import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
} from "@frak-labs/design-system/components/AlertDialog";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { PersonIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    InfoCard,
    InfoRow,
    infoCardStyles,
} from "@/module/common/component/InfoCard";
import { useMoneriumDisconnect } from "@/module/monerium/hooks/useMoneriumDisconnect";
import { useMoneriumStatus } from "@/module/monerium/hooks/useMoneriumStatus";
import { getMoneriumErrorKey } from "@/module/monerium/utils/moneriumErrors";
import { modalStore } from "@/module/stores/modalStore";

type RowAction = { label: string; onClick: () => void };

/**
 * Settings-level entry point for Monerium.
 *
 * "Connect", "Reconnect" and "Complete setup" open the bank-flow modal;
 * "Disconnect" asks for confirmation, then makes the backend forget the connection.
 */
export function MoneriumConnect() {
    const { t } = useTranslation();
    const { status } = useMoneriumStatus();
    const { disconnect, isPending, error } = useMoneriumDisconnect();
    const openModal = modalStore((s) => s.openModal);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const openFlow = () => openModal({ id: "moneriumBankFlow" });

    const actions: RowAction[] = [];
    if (status?.connection === "connected") {
        const isSetupDone =
            status.profile?.state === "approved" &&
            status.walletLink === "linked";
        if (!isSetupDone) {
            actions.push({
                label: t("monerium.completeSetup"),
                onClick: openFlow,
            });
        }
        actions.push({
            label: t("monerium.disconnect"),
            onClick: () => setConfirmOpen(true),
        });
    } else if (status) {
        actions.push({
            label: t(
                status.connection === "reauth_required"
                    ? "monerium.reconnect"
                    : "monerium.connect"
            ),
            onClick: openFlow,
        });
    }

    return (
        <>
            <InfoCard>
                <InfoRow
                    icon={PersonIcon}
                    label={t("monerium.account")}
                    action={
                        actions.length > 0 ? (
                            <Box display={"flex"} gap={"m"}>
                                {actions.map((action) => (
                                    <button
                                        key={action.label}
                                        type="button"
                                        className={infoCardStyles.actionButton}
                                        onClick={action.onClick}
                                        disabled={isPending}
                                    >
                                        <Text
                                            as="span"
                                            variant="bodySmall"
                                            color="action"
                                            weight="medium"
                                        >
                                            {action.label}
                                        </Text>
                                    </button>
                                ))}
                            </Box>
                        ) : null
                    }
                />
                {error ? (
                    <Text variant="bodySmall" color="error">
                        {t(getMoneriumErrorKey(error))}
                    </Text>
                ) : null}
            </InfoCard>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogTitle>
                        {t("monerium.disconnectConfirm.title")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("monerium.disconnectConfirm.description")}
                    </AlertDialogDescription>
                    <AlertDialogCancel asChild>
                        <Button variant="secondary">
                            {t("monerium.disconnectConfirm.cancel")}
                        </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                        <Button variant="primary" onClick={() => disconnect()}>
                            {t("monerium.disconnectConfirm.confirm")}
                        </Button>
                    </AlertDialogAction>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
