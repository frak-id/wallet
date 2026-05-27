import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
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
        <Stack space="xs" className={styles.card}>
            <Inline space="xs" alignY="baseline">
                <Text
                    as="span"
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                >
                    {label}
                </Text>
                <Text as="span" variant="caption" color="disabled">
                    {descriptor}
                </Text>
            </Inline>
            <span className={styles.amount}>{amount}</span>
            {delta !== undefined && (
                <Text
                    as="span"
                    variant="bodySmall"
                    className={delta >= 0 ? styles.deltaUp : styles.deltaDown}
                >
                    {delta >= 0 ? "▲" : "▼"} {delta > 0 ? "+" : ""}
                    {delta}%
                </Text>
            )}
        </Stack>
    );
}
