import { Text } from "@frak-labs/design-system/components/Text";

export function AffiliateLinkCreateError({
    show,
    message,
}: {
    show: boolean;
    message: string;
}) {
    if (!show) return null;
    return (
        <Text variant="bodySmall" color="error" align="center">
            {message}
        </Text>
    );
}
