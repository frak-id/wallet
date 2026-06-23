import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";

export const glassCircle = style({
    position: "relative",
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    border: "none",
    background: "none",
    padding: 0,
    color: "inherit",
    borderRadius: "9999px",
    outline: "none",
    selectors: {
        "&:focus": { outline: "none" },
        "&:focus-visible": { outline: "none" },
    },
});

export const glassCircleDisabled = style({
    color: vars.text.disabled,
    cursor: "not-allowed",
    pointerEvents: "none",
});

export const glassIcon = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
});
