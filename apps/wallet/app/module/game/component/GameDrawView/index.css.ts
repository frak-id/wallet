import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** A quiet text link; 44 px tall so a thumb can hit it. */
export const link = style({
    display: "inline-flex",
    alignItems: "center",
    minHeight: 44,
    color: vars.text.secondary,
    textDecoration: "underline",
    fontSize: "0.875rem",
});

/** A long pid or number must wrap rather than push the row off a 375 px screen. */
export const value = style({
    minWidth: 0,
    overflowWrap: "anywhere",
    textAlign: "right",
});

/** The whole id row is one 44 px copy target. */
export const pidRow = style({
    width: "100%",
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
    padding: 0,
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
});

export const pidIcon = style({
    color: vars.icon.primary,
    flexShrink: 0,
});
