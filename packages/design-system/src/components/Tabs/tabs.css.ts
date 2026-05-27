import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const tabsStyles = {
    list: style({
        display: "inline-flex",
        alignItems: "center",
        padding: "2px",
        borderRadius: "10px",
        backgroundColor: vars.surface.muted,
    }),
    trigger: style({
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: "28px",
        paddingLeft: alias.spacing.xl,
        paddingRight: alias.spacing.xl,
        borderRadius: alias.cornerRadius.s,
        border: "none",
        background: "transparent",
        fontFamily: "inherit",
        fontSize: "14px",
        lineHeight: "22px",
        fontWeight: 500,
        color: vars.text.disabled,
        cursor: "pointer",
        transition: "background-color 0.15s ease, color 0.15s ease",
        outlineOffset: "2px",
        whiteSpace: "nowrap",
        selectors: {
            '&[data-state="active"]': {
                backgroundColor: vars.surface.elevated,
                color: vars.text.primary,
            },
            '&:not([data-state="active"]):hover': {
                color: vars.text.secondary,
            },
            "&:disabled": {
                cursor: "not-allowed",
                opacity: 0.5,
            },
        },
    }),
    content: style({
        outline: "none",
    }),
};
