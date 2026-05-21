import { style } from "@vanilla-extract/css";

export const main = style({
    padding: "94px 24px 24px 264px",
    "@media": {
        "screen and (max-width: 768px)": {
            padding: "82px 12px 24px 76px",
        },
    },
});
