import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

// PageLayout content has no horizontal padding (so HeroContent images can
// bleed to the edges in other onboarding screens). This screen has only
// text + form, so we re-introduce the standard 16px page gutter here.
export const body = style({
    paddingInline: alias.spacing.m,
});

// Label and error caption sit inside the input's own gutter so they align
// with the placeholder/typed text (inset 16 from the input edge).
export const labelRow = style({
    paddingInline: alias.spacing.m,
});

export const errorRow = style({
    paddingInline: alias.spacing.m,
});

export const clearButton = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    color: vars.icon.primary,
});
