import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { previewWrapper } from "./preview-wrapper.css";

export function PreviewWrapper({
    label,
    children,
}: {
    label?: string;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div className={previewWrapper}>
            <Text variant="body" weight="medium" align="center">
                {label ?? t("shell.sections.preview")}
            </Text>
            {children}
        </div>
    );
}
