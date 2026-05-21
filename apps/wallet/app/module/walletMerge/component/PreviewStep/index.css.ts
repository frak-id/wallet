import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    paddingInline: alias.spacing.m,
    marginTop: alias.spacing.m,
});

export const arrow = style({
    display: "flex",
    justifyContent: "center",
    paddingBlock: alias.spacing.xxs,
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    width: "100%",
});
