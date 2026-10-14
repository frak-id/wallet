import { getIntFmt } from "../chart-formatters";
import * as styles from "../charts.css";

export interface TooltipRow {
    color: string;
    label: string;
    value: number;
}

interface TooltipContentProps {
    title?: string;
    rows: TooltipRow[];
    /** BCP-47 locale for numeric value formatting. */
    locale: string;
}

export function TooltipContent({ title, rows, locale }: TooltipContentProps) {
    const intFmt = getIntFmt(locale);
    return (
        <div className={styles.tooltipClip}>
            <div className={styles.tooltipBody}>
                {title && <div className={styles.tooltipTitle}>{title}</div>}
                <div>
                    {rows.map((row) => (
                        <div
                            className={styles.tooltipRow}
                            key={`${row.label}-${row.color}`}
                        >
                            <div className={styles.tooltipKey}>
                                <span
                                    className={styles.tooltipSwatch}
                                    style={{ backgroundColor: row.color }}
                                />
                                <span className={styles.tooltipLabel}>
                                    {row.label}
                                </span>
                            </div>
                            <span className={styles.tooltipValue}>
                                {intFmt.format(row.value)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

TooltipContent.displayName = "TooltipContent";
