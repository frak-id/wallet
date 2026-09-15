import { alias, safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Keep the auto-reconnect toast below the status bar. `/login` is not inside
 * AppShell, so it inherits none of the shell's safe-area padding and must add
 * the inset itself.
 */
export const reconnectToastOffset = style({
    top: `calc(${safeArea.top} + ${alias.spacing.s})`,
});
