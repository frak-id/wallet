import { style } from "@vanilla-extract/css";
import { vars } from "@/styles/theme.css";

export const button = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: vars.space.sm,
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    border: `1px solid ${vars.color.borderStrong}`,
    background: vars.color.accent,
    color: "#fff",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1,
    cursor: "pointer",
    transition:
        "background 0.15s ease, transform 0.05s ease, opacity 0.15s ease",
    userSelect: "none",
    selectors: {
        "&:hover:not(:disabled)": {
            background: vars.color.accentHover,
        },
        "&:active:not(:disabled)": {
            transform: "translateY(1px)",
        },
        "&:disabled": {
            opacity: 0.55,
            cursor: "not-allowed",
        },
        "&:focus-visible": {
            outline: `2px solid ${vars.color.accent}`,
            outlineOffset: "2px",
        },
        "& + &": {
            marginLeft: vars.space.sm,
        },
    },
});
