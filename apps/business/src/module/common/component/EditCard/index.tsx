import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";

/**
 * Card shell shared by the immersive Edit pages (merchant edit, push
 * creation): quiet group title, optional description, then the body blocks
 * (cells, fields, actions).
 */
export function EditCard({
    title,
    description,
    children,
}: {
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card radius="m">
            <Stack space="m">
                <Stack space="xxs">
                    <Text
                        as="h3"
                        variant="bodySmall"
                        weight="medium"
                        color="secondary"
                    >
                        {title}
                    </Text>
                    {description ? (
                        <Text variant="caption" color="tertiary">
                            {description}
                        </Text>
                    ) : null}
                </Stack>
                {children}
            </Stack>
        </Card>
    );
}
