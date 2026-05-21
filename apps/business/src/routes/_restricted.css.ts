import { style } from "@vanilla-extract/css";

export const main = style({
    padding: "104px 24px 24px 280px",
    "@media": {
        "screen and (max-width: 768px)": {
            padding: "104px 12px 24px 60px",
        },
    },
});
