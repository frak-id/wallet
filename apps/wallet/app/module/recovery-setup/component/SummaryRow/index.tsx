import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";

type SummaryRowProps = {
    label: string;
    value: ReactNode;
};

/**
 * Label/value row for the recovery status + date-refresh confirm summary cards.
 * Strings get the standard medium-weight treatment; nodes (badges, etc.) render
 * as-is.
 */
export function SummaryRow({ label, value }: SummaryRowProps) {
    return (
        <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            gap="s"
        >
            <Text variant="bodySmall" color="secondary">
                {label}
            </Text>
            {typeof value === "string" ? (
                <Text variant="bodySmall" weight="medium">
                    {value}
                </Text>
            ) : (
                value
            )}
        </Box>
    );
}
