import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const register__grid = style({});

globalStyle(`${register__grid} > div:first-child`, {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: brand.scale[900],
});
