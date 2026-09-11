import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const stepList = style({
    display: "flex",
    flexDirection: "column",
});

export const stepRow = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: alias.spacing.m,
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
});

export const stepText = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    flex: 1,
});
