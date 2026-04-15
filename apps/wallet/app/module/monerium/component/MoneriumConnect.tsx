import { Text } from "@frak-labs/design-system/components/Text";
import { PersonIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import {
    InfoCard,
    InfoRow,
    infoCardStyles,
} from "@/module/common/component/InfoCard";
import {
    isMoneriumConnected,
    moneriumStore,
} from "@/module/monerium/store/moneriumStore";
import { modalStore } from "@/module/stores/modalStore";

/**
 * Settings-level entry point for Monerium.
 *
 * When not connected: "Connect" opens the bank-flow modal (which walks
 * the user through OAuth → KYC → wallet linking → transfer).
 * When connected: "Disconnect" clears the local tokens.
 */
export function MoneriumConnect() {
    const { t } = useTranslation();
    const isConnected = moneriumStore(isMoneriumConnected);
    const openModal = modalStore((s) => s.openModal);
    const disconnect = moneriumStore((s) => s.disconnect);

    return (
        <InfoCard>
            <InfoRow
                icon={PersonIcon}
                label={t("monerium.account")}
                action={
                    isConnected ? (
                        <button
                            type="button"
                            className={infoCardStyles.actionButton}
                            onClick={disconnect}
                        >
                            <Text
                                as="span"
                                variant="bodySmall"
                                color="action"
                                weight="medium"
                            >
                                {t("monerium.disconnect")}
                            </Text>
                        </button>
                    ) : (
                        <button
                            type="button"
                            className={infoCardStyles.actionButton}
                            onClick={() =>
                                openModal({ id: "moneriumBankFlow" })
                            }
                        >
                            <Text
                                as="span"
                                variant="bodySmall"
                                color="action"
                                weight="medium"
                            >
                                {t("monerium.connect")}
                            </Text>
                        </button>
                    )
                }
            />
        </InfoCard>
    );
}
