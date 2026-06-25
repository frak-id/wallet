import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./detail-row.css";

type DetailRowProps = {
    label: ReactNode;
    /** Value cell — a `DetailValue`, or custom node (icon + value, stacked lines…). */
    children: ReactNode;
    /** Stacked/multi-line rows grow with vertical padding instead of a fixed height. */
    tall?: boolean;
};

/**
 * Read-only key → value row: secondary label on the left, right-aligned value on
 * the right. Shared by the campaign validation summary and the billing settings
 * summary (Figma `@ Cell details`).
 */
export function DetailRow({ label, children, tall }: DetailRowProps) {
    return (
        <div className={tall ? styles.rowTall : styles.row}>
            <Text variant="bodySmall" weight="medium" color="secondary">
                {label}
            </Text>
            {children}
        </div>
    );
}

type DetailValueProps = {
    children: ReactNode;
    /** Render the disabled "—" placeholder tone for empty values. */
    muted?: boolean;
};

/** Right-aligned value text. `muted` renders the disabled placeholder tone. */
export function DetailValue({ children, muted }: DetailValueProps) {
    return (
        <Text
            variant="bodySmall"
            weight="medium"
            color={muted ? "disabled" : undefined}
            align="right"
        >
            {children}
        </Text>
    );
}
