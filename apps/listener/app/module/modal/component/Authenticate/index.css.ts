import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Local replacement for the deleted wallet-shared `TextData` wrapper.
 * Used to preview the SIWE message inside the Authenticate modal step.
 */
export const textData = style({
    padding: "7px",
    background: vars.surface.muted,
    border: `1px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.s,
    fontSize: "12px",
    overflow: "auto",
});
