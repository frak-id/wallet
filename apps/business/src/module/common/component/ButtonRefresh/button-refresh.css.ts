import { keyframes, style } from "@vanilla-extract/css";

const spin = keyframes({
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
});

export const buttonRefresh = style({
    display: "flex",
});

export const buttonRefreshing = style({
    selectors: {
        "&  > svg": {
            animation: `${spin} 1s linear infinite`,
        },
    },
});
