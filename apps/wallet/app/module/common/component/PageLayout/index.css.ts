import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    flexDirection: "column",
    // Fills main's scroll area, negative margins bleed into main's padding.
    minHeight: `calc(100% + 2 * ${alias.spacing.m})`,
    marginRight: `calc(-1 * ${alias.spacing.m})`,
    marginBottom: `calc(-1 * ${alias.spacing.m})`,
    marginLeft: `calc(-1 * ${alias.spacing.m})`,
    background: vars.surface.background,
    selectors: {
        // Only bleed top when nothing precedes us.
        "&:first-child": {
            marginTop: `calc(-1 * ${alias.spacing.m})`,
        },
    },
});

// Cancel the bottom bleed so the sticky footer clears main's nav-bar inset.
export const containerFixed = style({
    marginBottom: 0,
});

export const content = style({
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    paddingTop: alias.spacing.m,
    paddingBottom: alias.spacing.m,
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
});

// Opaque bar pinned at the scrollport bottom; content scrolls above it (no
// overlap). main owns the safe-area inset; this adds the design gap.
export const footerSticky = style({
    position: "sticky",
    bottom: 0,
    zIndex: 1,
    background: vars.surface.background,
    paddingTop: alias.spacing.l,
});
