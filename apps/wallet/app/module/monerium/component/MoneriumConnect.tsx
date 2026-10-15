import { Text } from "@frak-labs/design-system/components/Text";
import { PersonIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import {
    InfoCard,
    InfoRow,
    infoCardStyles,
} from "@/module/common/component/InfoCard";
import { useMoneriumDisconnect } from "@/module/monerium/hooks/useMoneriumDisconnect";
import { useMoneriumStatus } from "@/module/monerium/hooks/useMoneriumStatus";
import { modalStore } from "@/module/stores/modalStore";

/**
 * Settings-level entry point for Monerium.
 *
 * "Connect" and "Reconnect" open the bank-flow modal; "Disconnect" makes the
 * backend forget the connection.
 */
export function MoneriumConnect() {
    const { t } = useTranslation();
    const { status } = useMoneriumStatus();
    const { disconnect, isPending } = useMoneriumDisconnect();
    const openModal = modalStore((s) => s.openModal);

    const openFlow = () => openModal({ id: "moneriumBankFlow" });

    const action = (() => {
        if (!status) return null;
        if (status.connection === "connected") {
            return {
                label: t("monerium.disconnect"),
                onClick: () => disconnect(),
            };
        }
        return {
            label: t(
                status.connection === "reauth_required"
                    ? "monerium.reconnect"
                    : "monerium.connect"
            ),
            onClick: openFlow,
        };
    })();

    return (
        <InfoCard>
            <InfoRow
                icon={PersonIcon}
                label={t("monerium.account")}
                action={
                    action ? (
                        <button
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
                    ) : null
                }
            />
        </InfoCard>
    );
}
