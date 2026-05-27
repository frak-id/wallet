import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const bar = style({
    display: "flex",
    height: "4px",
    borderRadius: alias.cornerRadius.full,
    overflow: "hidden",
});

export const segment = style({
    height: "100%",
});

export const dot = style({
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    flexShrink: 0,
});
