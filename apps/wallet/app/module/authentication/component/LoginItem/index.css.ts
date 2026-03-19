import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const loginItem = style({
    paddingRight: brand.scale[300],
});

export const loginItem__button = style({
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: brand.scale[200],
    marginBottom: brand.scale[300],
});

export const loginItem__name = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[200],
    marginBottom: brand.scale[100],
});

export const loginItem__icon = style({
    display: "block",
});
