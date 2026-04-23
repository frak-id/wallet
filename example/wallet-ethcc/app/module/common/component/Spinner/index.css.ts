import { keyframes, style } from "@vanilla-extract/css";

const spin = keyframes({
    to: { transform: "rotate(360deg)" },
});

export const spinner = style({
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: "2px solid currentColor",
    borderRightColor: "transparent",
    borderRadius: "50%",
    animation: `${spin} 0.7s linear infinite`,
    verticalAlign: "middle",
});
