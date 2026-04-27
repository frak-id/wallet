import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumSuccessScreenProps = {
    onClose: () => void;
};

/**
 * Shown once after the user has fully set up their Monerium account
 * (KYC approved + wallet linked).
 *
 * CTA marks the success as seen and transitions to the transfer screen.
 */
export function MoneriumSuccessScreen({ onClose }: MoneriumSuccessScreenProps) {
    const { t } = useTranslation();

    const handleContinue = () => {
        moneriumStore.getState().markSetupSuccessSeen();
    };

    return (
        <MoneriumScreen
            onClose={onClose}
            title={t("monerium.bankFlow.success.title")}
            ctaLabel={t("monerium.bankFlow.success.cta")}
            ctaOnClick={handleContinue}
        >
            <Text variant="body" color="secondary">
                {t("monerium.bankFlow.success.description")}
            </Text>
        </MoneriumScreen>
    );
}
