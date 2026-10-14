import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ReactNode, useContext } from "react";
import { marker } from "./gallery.css";
import { FindingMarkers } from "./markers";

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
    const kinds = useContext(FindingMarkers)?.get(name);
    const label = (
        <Text as="span" variant="caption" color="secondary">
            {name}
        </Text>
    );
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
            {kinds ? (
                <Box display="flex" gap="xs" alignItems="center">
                    {label}
                    <span
                        className={marker}
                        role="img"
                        aria-label={`known ${kinds.join(" and ")} finding`}
                    >
                        {kinds.join(" · ")}
                    </span>
                </Box>
            ) : (
                label
            )}
            <Box display={fill ? "block" : "flex"}>{children}</Box>
        </Box>
    );
}

/** `stack` gives each case its own full-width row, for content that may be long. */
export function Cases({
    title,
    layout = "wrap",
    children,
}: {
    title: string;
    layout?: "wrap" | "stack";
    children: ReactNode;
}) {
    return (
        <Stack space="s">
            <Box as="h3">
                <Text as="span" variant="heading5">
                    {title}
                </Text>
            </Box>
            <Box
                display="flex"
                flexDirection={layout === "stack" ? "column" : "row"}
                flexWrap={layout === "stack" ? "nowrap" : "wrap"}
                gap="l"
            >
                {children}
            </Box>
        </Stack>
    );
}
