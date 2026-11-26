import { Notice } from "@frak-labs/design-system/components/Notice";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";

export function ActionFeedback({
    isPending = false,
    isError,
}: {
    isPending?: boolean;
    isError: boolean;
}) {
    const { t } = useTranslation();

    if (isPending) {
        return (
            <Text variant="caption" color="secondary">
                {t("funding.pending")}
            </Text>
        );
    }

    if (isError) {
        return (
            <Notice tone="error" role="alert">
                {t("funding.errors.action")}
            </Notice>
        );
    }

    return null;
}
