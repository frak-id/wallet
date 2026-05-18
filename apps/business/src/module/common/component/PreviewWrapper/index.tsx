import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import { previewWrapper } from "./preview-wrapper.css";

export function PreviewWrapper({
    label = "Preview",
    children,
}: {
    label?: string;
    children: ReactNode;
}) {
    return (
        <div className={previewWrapper}>
            <Text variant="overline" color="tertiary">
                {label}
            </Text>
            {children}
        </div>
    );
}
