import { Box } from "@frak-labs/design-system/components/Box";
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
            ctaLabel={t("monerium.bankFlow.success.cta")}
            ctaOnClick={handleContinue}
        >
            <Box display={"flex"} flexDirection={"column"} gap={"s"}>
                <Text variant="heading1">
                    {t("monerium.bankFlow.success.title")}
                </Text>
                <Text variant="body" color="secondary">
                    {t("monerium.bankFlow.success.description")}
                </Text>
            </Box>
        </MoneriumScreen>
    );
}
