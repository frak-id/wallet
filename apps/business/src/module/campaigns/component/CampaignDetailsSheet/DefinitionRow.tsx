import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./campaign-details-sheet.css";

/** Label on the left, value on the right, hairline-separated rows. */
export function DefinitionRow({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className={styles.definitionRow}>
            <Text as="span" variant="bodySmall" color="secondary">
                {label}
            </Text>
            <span className={styles.definitionValue}>{children}</span>
        </div>
    );
}

export function ValueText({ children }: { children: ReactNode }) {
    return (
        <Text as="span" variant="bodySmall" weight="medium">
            {children}
        </Text>
    );
}
