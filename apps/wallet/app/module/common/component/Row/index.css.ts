import { style } from "@vanilla-extract/css";
import { brand } from "@/tokens.css";

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
