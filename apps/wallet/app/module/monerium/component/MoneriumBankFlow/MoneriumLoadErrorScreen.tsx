import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumLoadErrorScreenProps = {
    onClose: () => void;
    onRetry: () => void;
};

export function MoneriumLoadErrorScreen({
    onClose,
    onRetry,
}: MoneriumLoadErrorScreenProps) {
    const { t } = useTranslation();

    return (
        <MoneriumScreen
            onClose={onClose}
            title={t("monerium.bankFlow.loadError.title")}
            ctaLabel={t("monerium.bankFlow.loadError.retry")}
            ctaOnClick={onRetry}
        >
            <Text variant="body" color="secondary">
                {t("monerium.bankFlow.loadError.description")}
            </Text>
        </MoneriumScreen>
    );
}
