import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const row = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[200],
    width: "100%",
    selectors: {
        "& + &": {
            marginTop: brand.scale[200],
        },
    },
});

export const withIcon = style({});
