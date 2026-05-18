import { vars } from "@frak-labs/design-system/theme";
import { globalStyle, keyframes, style } from "@vanilla-extract/css";

const spin = keyframes({
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
});

export const buttonRefresh = style({
    all: "unset",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    cursor: "pointer",
    color: vars.text.primary,
    transition: "background-color 0.15s ease",
    selectors: {
        "&:hover": {
            backgroundColor: vars.surface.muted,
        },
        "&:active": {
            backgroundColor: vars.surface.secondary,
        },
        "&:focus-visible": {
            outline: `2px solid ${vars.border.focus}`,
            outlineOffset: "2px",
        },
    },
});

export const buttonRefreshing = style({});

globalStyle(`${buttonRefreshing} > svg`, {
    animation: `${spin} 1s linear infinite`,
});
