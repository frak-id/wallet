import { Card } from "@frak-labs/design-system/components/Card";
import { DeltaIndicator } from "@frak-labs/design-system/components/DeltaIndicator";
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
        <Card className={styles.cell} radius="m">
            <Stack space="xxs">
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
                <Stack space="none">
                    <span className={styles.amount}>{amount}</span>
                    {delta !== undefined && <DeltaIndicator delta={delta} />}
                </Stack>
            </Stack>
        </Card>
    );
}
