import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const chip = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    height: "36px",
    padding: `0 ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.muted,
    color: vars.text.primary,
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
});

export const chipActive = style({
    backgroundColor: vars.surface.secondary,
    fontWeight: 600,
});

// Popover portals to <body> with z-index auto; the fixed header sits at
// z-index 1 and would otherwise paint over the popover's top edge.
export const popoverContent = style({
    zIndex: 50,
});

export const panel = style({
    display: "flex",
    gap: alias.spacing.m,
    padding: alias.spacing.s,
});

export const presetColumn = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    paddingRight: alias.spacing.s,
    borderRight: `1px solid ${vars.border.subtle}`,
    minWidth: "132px",
});

export const presetButton = style({
    textAlign: "left",
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.m,
    border: "none",
    backgroundColor: "transparent",
    color: vars.text.primary,
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    ":hover": {
        backgroundColor: vars.surface.muted,
    },
});

export const presetButtonActive = style({
    backgroundColor: vars.surface.muted,
    fontWeight: 600,
});

export const clearButton = style({
    marginTop: alias.spacing.xs,
    textAlign: "left",
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.m,
    border: "none",
    backgroundColor: "transparent",
    color: vars.text.tertiary,
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    ":hover": {
        color: vars.text.primary,
        backgroundColor: vars.surface.muted,
    },
});
