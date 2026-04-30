import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
    width: "100%",
});

export const content = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    alignItems: "center",
    width: "100%",
});

export const text = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    width: "100%",
    textAlign: "center",
});

export const title = style({
    margin: 0,
    color: vars.text.primary,
});

export const description = style({
    margin: 0,
    color: vars.text.secondary,
});

export const actions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
});
