import { Text } from "@frak-labs/design-system/components/Text";

export function MutedText({ children }: { children: React.ReactNode }) {
    return (
        <Text variant="bodySmall" as="span" color="tertiary">
            {children}
        </Text>
    );
}
