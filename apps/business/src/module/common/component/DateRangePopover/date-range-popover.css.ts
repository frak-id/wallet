import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { focusRing, interactive } from "@/module/common/styles/interaction.css";

// Lift above a fixed header (z-index 1) when needed; the popover portals to
// <body> with z-index auto otherwise.
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

export const presetButton = style([
    interactive,
    focusRing,
    {
        textAlign: "left",
        padding: `${alias.spacing.xs} ${alias.spacing.s}`,
        borderRadius: alias.cornerRadius.m,
        border: "none",
        backgroundColor: "transparent",
        color: vars.text.primary,
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: brand.typography.fontWeight.medium,
        whiteSpace: "nowrap",
        ":hover": {
            backgroundColor: vars.surface.muted,
        },
    },
]);

export const presetButtonActive = style({
    backgroundColor: vars.surface.muted,
    fontWeight: brand.typography.fontWeight.semiBold,
});

export const clearButton = style([
    interactive,
    focusRing,
    {
        marginTop: alias.spacing.xs,
        textAlign: "left",
        padding: `${alias.spacing.xs} ${alias.spacing.s}`,
        borderRadius: alias.cornerRadius.m,
        border: "none",
        backgroundColor: "transparent",
        color: vars.text.tertiary,
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: brand.typography.fontWeight.medium,
        ":hover": {
            color: vars.text.primary,
            backgroundColor: vars.surface.muted,
        },
    },
]);
