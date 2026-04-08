import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const statContent = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    flex: "1",
    minWidth: "0",
});

export const icon = style({
    display: "flex",
});

export const label = style({
    lineHeight: "17px",
});
