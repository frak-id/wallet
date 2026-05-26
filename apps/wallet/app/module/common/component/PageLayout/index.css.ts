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

/**
 * Header row rendered when any of `back`, `headerCenter` or `headerEnd` is
 * set. Uses a 3-column grid so the center slot stays truly centered no
 * matter how wide the left / right slots get — important for the merge
 * flow's step indicator, which has to read centered next to a variable-
 * width back button.
 */
export const header = style({
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    paddingInline: alias.spacing.m,
    width: "100%",
});

export const headerLeft = style({
    justifySelf: "start",
    display: "flex",
    alignItems: "center",
    minWidth: 0,
});

export const headerCenter = style({
    justifySelf: "center",
    display: "flex",
    alignItems: "center",
    textAlign: "center",
});

export const headerEnd = style({
    justifySelf: "end",
    display: "flex",
    alignItems: "center",
    minWidth: 0,
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: alias.spacing.m,
});

// Onboarding screens (those passing `fixedViewport`) keep the CTA off the
// home indicator with a 32px floor that grows on devices with a larger inset.
export const footerFixed = style({
    paddingBottom: `max(${alias.spacing.xl}, env(safe-area-inset-bottom))`,
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
