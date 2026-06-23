import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const merchantGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: alias.spacing.m,
    "@media": {
        "screen and (max-width: 1080px)": {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        },
        "screen and (max-width: 720px)": {
            gridTemplateColumns: "minmax(0, 1fr)",
        },
    },
});
