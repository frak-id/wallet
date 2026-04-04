import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumTransferScreenProps = {
    onClose: () => void;
};

/**
 * Placeholder transfer screen — shown when the Monerium account is
 * fully set up. IBAN selection and transfer form will come later.
 */
export function MoneriumTransferScreen({
    onClose,
}: MoneriumTransferScreenProps) {
    const { t } = useTranslation();

    return (
        <MoneriumScreen
            onClose={onClose}
            ctaLabel={t("monerium.bankFlow.transfer.cta")}
            ctaOnClick={onClose}
        >
            <Box display={"flex"} flexDirection={"column"} gap={"s"}>
                <Text variant="heading1">
                    {t("monerium.bankFlow.transfer.title")}
                </Text>
                <Text variant="body" color="secondary">
                    {t("monerium.bankFlow.transfer.description")}
                </Text>
            </Box>
        </MoneriumScreen>
    );
}
