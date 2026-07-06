import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Keep the auto-reconnect toast below the status bar. `/login` is not inside
 * AppShell's safe-area padding, so add the native inset explicitly. Android
 * WebView doesn't honor `env(safe-area-inset-top)`, so prefer the
 * `--safe-area-inset-top` var the safe-area plugin mirrors, falling back to
 * `env()` then 0.
 */
export const reconnectToastOffset = style({
    top: `calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + ${alias.spacing.s})`,
});
