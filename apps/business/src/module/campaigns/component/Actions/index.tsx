import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import { Check, X } from "lucide-react";

export function ActionsMessageSuccess() {
    return (
        <Inline space="s" alignY="center">
            <Check />
            <Text as="span" color="success" weight="semiBold">
                All changes have been saved
            </Text>
        </Inline>
    );
}

export function ActionsMessageError({ error }: { error?: Error }) {
    return (
        <Inline space="s" alignY="center">
            <X />
            <Text as="span" color="error" weight="semiBold">
                {error?.message ?? "An error occurred"}
            </Text>
        </Inline>
    );
}
