import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Fills the region the thrown subtree occupied, rather than the viewport:
 * the shell's chrome renders outside this boundary and must stay visible.
 */
export const fallback = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.l,
    textAlign: "center",
});

export const description = style({
    color: vars.text.secondary,
    maxWidth: "320px",
});
