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

// Pin the page to main's content box height so the footer stays in view
// instead of being pushed out by tall content. Negative-margin bleed from
// `container` is compensated by adding 2 * spacing.m to the target height.
export const containerFixed = style({
    height: `calc(100% + 2 * ${alias.spacing.m})`,
    minHeight: 0,
});

// Suppress scroll inside the page so children must shrink to fit.
export const contentFixed = style({
    overflow: "hidden",
});
