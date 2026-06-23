import { Card } from "@frak-labs/design-system/components/Card";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";

type WarningCardProps = {
    children: ReactNode;
};

/**
 * Muted card carrying an error-toned message. Used for the destructive-action
 * warnings and inline failures across the flow screens (recovery setup, etc.)
 * so the callout treatment stays consistent in one place.
 */
export function WarningCard({ children }: WarningCardProps) {
    return (
        <Card variant="muted" padding="default">
            <Text variant="bodySmall" color="error">
                {children}
            </Text>
        </Card>
    );
}
