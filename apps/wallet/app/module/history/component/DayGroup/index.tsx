import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { HistoryGroup } from "@frak-labs/wallet-shared";
import type { ReactNode } from "react";

/**
 * Component for an history day group with optional per-day totals
 */
export function HistoryDayGroup<T>({
    group,
    innerComponent,
    dayTotals,
}: {
    group: HistoryGroup<T>;
    innerComponent: (item: T) => ReactNode;
    dayTotals?: Record<string, number>;
}) {
    return Object.entries(group).map(([day, items]) => (
        <Stack key={day} space="xs">
            <Inline
                space="none"
                align="space-between"
                alignY="baseline"
                wrap={false}
            >
                <Text as="h2" variant="bodySmall" color="secondary">
                    {day}
                </Text>
                {dayTotals?.[day] != null && (
                    <DayTotal amount={dayTotals[day]} />
                )}
            </Inline>
            <Card padding="none">
                {items.map((item, index) => (
                    <Box key={`${day}-${index}`}>{innerComponent(item)}</Box>
                ))}
            </Card>
        </Stack>
    ));
}

function DayTotal({ amount }: { amount: number }) {
    const formatted = `+${amount.toFixed(2).replace(".", ",")}€`;
    return (
        <Text variant="caption" color="secondary">
            {formatted}
        </Text>
    );
}
