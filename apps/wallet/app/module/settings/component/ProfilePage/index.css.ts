import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const page = style({
    width: "100%",
});

export const title = style({
    letterSpacing: "-0.03em",
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xxs,
    marginTop: alias.spacing.s,
});

export const version = style({
    marginTop: alias.spacing.xxs,
});
