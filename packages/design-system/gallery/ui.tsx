import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";

/**
 * Labelled cell. `name` is what a spec prints and keys known findings on;
 * `fill` gives content that sizes from its parent (charts) a real width.
 * Content sits in a shrinkable flex row, so only what cannot shrink below its
 * min-content (an unbreakable string) can overflow, as it would in a layout.
 */
export function Case({
    name,
    fill,
    children,
}: {
    name: string;
    fill?: boolean;
    children: ReactNode;
}) {
    return (
        <Box
            data-gallery-case={name}
            display="flex"
            flexDirection="column"
            gap="xxs"
            style={{
                minWidth: 0,
                maxWidth: "100%",
                ...(fill && { width: 480 }),
            }}
        >
            <Text as="span" variant="tiny" color="tertiary">
                {name}
            </Text>
            <Box display={fill ? "block" : "flex"}>{children}</Box>
        </Box>
    );
}

export function Cases({ children }: { children: ReactNode }) {
    return (
        <Box display="flex" flexWrap="wrap" gap="m">
            {children}
        </Box>
    );
}
