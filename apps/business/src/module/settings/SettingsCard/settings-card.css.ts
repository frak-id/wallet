import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const header = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
});

export const headerText = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    flex: 1,
    minWidth: 0,
});

export const action = style({
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
});
