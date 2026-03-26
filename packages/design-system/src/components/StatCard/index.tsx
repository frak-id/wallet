import type { ReactNode } from "react";
import { Box } from "../Box";
import { Text } from "../Text";
import { statCardStyles } from "./statCard.css";

type StatCardProps = {
    amount: string;
    label: string;
    icon?: ReactNode;
    highlighted?: boolean;
};

export function StatCard({
    amount,
    label,
    icon,
    highlighted = false,
}: StatCardProps) {
    const amountClass = highlighted
        ? statCardStyles.amountHighlighted
        : statCardStyles.amount;

    return (
        <Box className={statCardStyles.container}>
            <Box as="span" className={amountClass}>
                {amount}
            </Box>
            <Box className={statCardStyles.labelRow}>
                {icon && (
                    <Box as="span" className={statCardStyles.icon}>
                        {icon}
                    </Box>
                )}
                <Text variant="bodySmall" weight="semiBold" color="secondary">
                    {label}
                </Text>
            </Box>
        </Box>
    );
}
