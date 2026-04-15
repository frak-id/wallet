import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const sliderRoot = style({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    userSelect: "none",
    touchAction: "none",
    width: "100%",
    height: "20px",
});

export const sliderTrack = style({
    position: "relative",
    flexGrow: 1,
    height: "4px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.muted,
});

export const sliderRange = style({
    position: "absolute",
    height: "100%",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.primary,
});

export const sliderThumb = style({
    display: "block",
    position: "relative",
    width: "20px",
    height: "20px",
    backgroundColor: vars.surface.background,
    border: `2px solid ${vars.surface.primary}`,
    borderRadius: alias.cornerRadius.full,
    cursor: "pointer",
    transition: "box-shadow 0.15s ease",
    ":focus-visible": {
        outline: "none",
        boxShadow: `0 0 0 3px ${vars.border.focus}`,
    },
});
