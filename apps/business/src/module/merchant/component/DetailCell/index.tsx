import type { ReactNode } from "react";
import * as styles from "../detail-cells.css";

/**
 * Rounded container grouping read-only {@link DetailCell} rows (label left,
 * value right). Shared by the merchant Edit page cards and sheets.
 */
export function DetailCells({ children }: { children: ReactNode }) {
    return <div className={styles.detailCells}>{children}</div>;
}

/** A single label/value row inside {@link DetailCells}. */
export function DetailCell({
    label,
    value,
}: {
    label: ReactNode;
    value: ReactNode;
}) {
    return (
        <div className={styles.detailCell}>
            <span className={styles.cellLabel}>{label}</span>
            <span className={styles.cellValue}>{value}</span>
        </div>
    );
}
