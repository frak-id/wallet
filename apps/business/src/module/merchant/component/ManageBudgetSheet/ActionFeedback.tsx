import { Notice } from "@frak-labs/design-system/components/Notice";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";

export function ActionFeedback({
    isPending = false,
    isError,
    pendingText,
}: {
    isPending?: boolean;
    isError: boolean;
    pendingText?: string;
}) {
    const { t } = useTranslation();

    if (isPending) {
        return (
            <Text variant="caption" color="secondary">
                {pendingText ?? t("funding.pending")}
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
