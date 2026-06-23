import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const separator = style({
    backgroundColor: brand.colors.neutral.grey250,
    selectors: {
        '&[data-orientation="horizontal"]': {
            height: "1px",
            width: "100%",
        },
        '&[data-orientation="vertical"]': {
            height: "100%",
            width: "1px",
        },
    },
});
