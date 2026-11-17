import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const icon = style({
    flexShrink: 0,
    color: vars.icon.primary,
});

export const link = style({
    flex: "1 0 0",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});
