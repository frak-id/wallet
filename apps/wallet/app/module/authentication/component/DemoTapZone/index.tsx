import { Box } from "@frak-labs/design-system/components/Box";
import type { PropsWithChildren } from "react";
import { useDemoTap } from "@/module/authentication/hook/useDemoTap";

/**
 * Wraps an element with the hidden demo-mode access (5 taps within 2s).
 *
 * Renders children as-is when disabled (non-Tauri builds), so it's a safe
 * passthrough on web. Inside Tauri, taps on the wrapped element are
 * counted and trigger navigation to the demo registration route.
 */
export function DemoTapZone({
    navigate,
    to,
    children,
}: PropsWithChildren<{
    navigate: (opts: { to: string }) => void;
    to?: string;
}>) {
    const { onTap, enabled } = useDemoTap(navigate, to);

    if (!enabled) return <>{children}</>;

    return (
        <Box as="span" role="presentation" onClick={onTap}>
            {children}
        </Box>
    );
}
