import { tablet } from "@frak-labs/design-system/breakpoints";
import { style } from "@vanilla-extract/css";

export const main = style({
    padding: "82px 12px 24px 76px",
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            padding: "94px 24px 24px 264px",
        },
    },
});
