import { style } from "@vanilla-extract/css";

export const inputWithToggleButton = style({
    all: "unset",
    cursor: "pointer",
    selectors: {
        "&:disabled": {
            cursor: "not-allowed",
            opacity: 0.3,
        },
    },
});
