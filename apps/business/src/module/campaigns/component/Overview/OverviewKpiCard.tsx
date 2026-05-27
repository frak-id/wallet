import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "./kpiCard.css";

type Props = {
    label: string;
    descriptor: string;
    amount: string;
    delta?: number;
};

export function OverviewKpiCard({ label, descriptor, amount, delta }: Props) {
    return (
        <div className={styles.card}>
            <div className={styles.headerRow}>
                <Text as="span" variant="bodySmall" weight="semiBold">
                    {label}
                </Text>
                <span className={styles.descriptor}>{descriptor}</span>
            </div>
            <span className={styles.amount}>{amount}</span>
            {delta !== undefined && (
                <span
                    className={`${styles.delta} ${
                        delta >= 0 ? styles.deltaUp : styles.deltaDown
                    }`}
                >
                    {delta >= 0 ? "▲" : "▼"} {delta > 0 ? "+" : ""}
                    {delta}%
                </span>
            )}
        </div>
    );
}
