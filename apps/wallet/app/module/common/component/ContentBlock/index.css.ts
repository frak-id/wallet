import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const content = recipe({
    base: {
        display: "flex",
        flexDirection: "column",
    },
    variants: {
        spacing: {
            m: { gap: alias.spacing.m },
            l: { gap: alias.spacing.l },
        },
    },
    defaultVariants: {
        spacing: "m",
    },
});

export const icon = style({
    display: "flex",
    justifyContent: "center",
});

export const text = recipe({
    base: {
        display: "flex",
        flexDirection: "column",
    },
    variants: {
        spacing: {
            xs: { gap: alias.spacing.xs },
            m: { gap: alias.spacing.m },
        },
    },
    defaultVariants: {
        spacing: "xs",
    },
});

export const title = style({
    textAlign: "center",
    margin: 0,
});

export const description = style({
    fontSize: fontSize.m,
    color: vars.text.secondary,
    textAlign: "center",
    margin: 0,
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    alignItems: "center",
});
