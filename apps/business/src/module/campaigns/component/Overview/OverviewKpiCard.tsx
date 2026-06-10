import { Card } from "@frak-labs/design-system/components/Card";
import { DeltaIndicator } from "@frak-labs/design-system/components/DeltaIndicator";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { EMPTY_AMOUNT } from "./constants";
import * as styles from "./kpiCard.css";

type Props = {
    label: string;
    descriptor: string;
    amount: string;
    delta?: number;
    hint?: string;
    // No data for this metric yet: show a muted `·` placeholder, drop the delta
    // chip, and surface a "No data yet" line instead of any approximate hint.
    empty?: boolean;
};

export function OverviewKpiCard({
    label,
    descriptor,
    amount,
    delta,
    hint,
    empty,
}: Props) {
    const { t } = useTranslation();
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
                {empty ? (
                    <span className={styles.amountEmpty}>{EMPTY_AMOUNT}</span>
                ) : (
                    <span className={styles.amount}>{amount}</span>
                )}
                {!empty && delta !== undefined && (
                    <DeltaIndicator delta={delta} />
                )}
                {empty ? (
                    <Text as="span" variant="caption" color="tertiary">
                        {t("campaigns.overview.kpi.noData")}
                    </Text>
                ) : (
                    hint && (
                        <Text
                            as="span"
                            variant="caption"
                            className={styles.hint}
                        >
                            {hint}
                        </Text>
                    )
                )}
            </Stack>
        </Card>
    );
}
