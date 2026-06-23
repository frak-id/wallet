import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Box } from "../Box";
import { Inline } from "../Inline";
import { Stack } from "../Stack";
import {
    subtitleLarge,
    titleBlock,
    titleLarge,
    title as titleStyle,
    toolbar,
} from "./sheet-toolbar.css";

type SheetToolbarProps = {
    /** Slot for the close (or back) affordance, shown on the left. */
    leading?: ReactNode;
    /** Main title — rendered as the accessible Dialog title. */
    title: ReactNode;
    /** Subtitle row (descriptive text, status tag, etc.). */
    subtitle?: ReactNode;
    /** Trailing action slot — typically a small pill button. */
    action?: ReactNode;
    /**
     * `default` is the compact inline bar; `large` stacks a bold headline
     * (and subtitle) under the controls row.
     */
    size?: "default" | "large";
};

/**
 * Sheet header following the iOS-26 toolbar spec — sticky bar with a liquid-glass
 * leading slot, title + subtitle block, and a trailing action. Pair with
 * `<SheetContent padded={false} hideCloseButton>`.
 */
export function SheetToolbar({
    leading,
    title,
    subtitle,
    action,
    size = "default",
}: SheetToolbarProps) {
    if (size === "large") {
        return (
            <Box
                className={toolbar}
                position="sticky"
                paddingX="l"
                paddingTop="l"
                paddingBottom="xs"
            >
                <Inline space="m" align="space-between" alignY="center">
                    {leading && (
                        <Box display="flex" alignItems="center" flexShrink={0}>
                            {leading}
                        </Box>
                    )}
                    {action && <Box flexShrink={0}>{action}</Box>}
                </Inline>
                <Box paddingTop="m">
                    <RadixDialog.Title className={titleLarge}>
                        {title}
                    </RadixDialog.Title>
                </Box>
                {subtitle && (
                    <Box paddingTop="xs" className={subtitleLarge}>
                        {subtitle}
                    </Box>
                )}
            </Box>
        );
    }

    return (
        <Box
            className={toolbar}
            position="sticky"
            paddingX="l"
            paddingTop="l"
            paddingBottom="xs"
        >
            <Inline space="m" alignY="center" wrap={false}>
                {leading && (
                    <Box display="flex" alignItems="center" flexShrink={0}>
                        {leading}
                    </Box>
                )}
                <Box className={titleBlock} flexGrow={1}>
                    <Stack space="none" justify="center">
                        <RadixDialog.Title className={titleStyle}>
                            {title}
                        </RadixDialog.Title>
                        {subtitle && (
                            <Inline space="xs" alignY="center">
                                {subtitle}
                            </Inline>
                        )}
                    </Stack>
                </Box>
                {action && <Box flexShrink={0}>{action}</Box>}
            </Inline>
        </Box>
    );
}
