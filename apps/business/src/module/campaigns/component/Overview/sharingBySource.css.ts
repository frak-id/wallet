import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const legend = style({
    display: "flex",
    gap: alias.spacing.s,
    justifyContent: "center",
    flexWrap: "wrap",
});

export const item = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
});

export const dot = style({
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    flexShrink: 0,
});
