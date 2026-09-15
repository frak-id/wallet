import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { FloatingFooter } from "@/module/common/component/FloatingFooter";

export function SaveFooter({
    disabled,
    isSaving,
    onSave,
    label,
}: {
    disabled: boolean;
    isSaving: boolean;
    onSave: () => void;
    label?: string;
}) {
    const { t } = useTranslation();
    return (
        <FloatingFooter bare align="content">
            <Stack space="xxs">
                <Button
                    variant="primary"
                    size="large"
                    width="auto"
                    onClick={onSave}
                    disabled={disabled || isSaving}
                    loading={isSaving}
                >
                    {label ?? t("customize.save")}
                </Button>
                {!disabled && (
                    <Text variant="caption" color="tertiary">
                        {t("customize.propagationHint")}
                    </Text>
                )}
            </Stack>
        </FloatingFooter>
    );
}
