import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const actions = style({
    display: "flex",
});

export const actionLeft = style({
    flex: 1,
    display: "flex",
    gap: "15px",
});

export const actionRight = style({
    flex: 1,
    display: "flex",
    gap: alias.spacing.xs,
    justifyContent: "flex-end",
});
