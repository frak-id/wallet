import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

export const content = styleVariants({
    m: {
        display: "flex",
        flexDirection: "column",
        gap: alias.spacing.m,
    },
    l: {
        display: "flex",
        flexDirection: "column",
        gap: alias.spacing.l,
    },
});

export const icon = style({
    display: "flex",
    justifyContent: "center",
});

export const text = styleVariants({
    xs: {
        display: "flex",
        flexDirection: "column",
        gap: alias.spacing.xs,
    },
    m: {
        display: "flex",
        flexDirection: "column",
        gap: alias.spacing.m,
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
