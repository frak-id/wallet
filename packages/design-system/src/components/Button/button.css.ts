import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { alias } from "@/tokens.css";

const base = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.xs,
    width: "100%",
    minHeight: "48px",
    padding: `${alias.spacing.m} ${alias.spacing.l}`,
    borderRadius: alias.cornerRadius.full,
    fontWeight: 700,
    fontSize: "16px",
    cursor: "pointer",
    border: "none",
    textDecoration: "none",
    transition: "background-color 0.2s ease",
    ":focus": {
        outline: "none",
    },
});

export const buttonStyles = {
    base,
    primary: style([
        base,
        {
            backgroundColor: vars.surface.primary,
            color: vars.text.onAction,
            border: "none",
            ":hover": {
                backgroundColor: vars.surface.primaryHover,
            },
            ":active": {
                backgroundColor: vars.surface.primaryPressed,
            },
        },
    ]),
    outlined: style([
        base,
        {
            backgroundColor: "transparent",
            color: vars.text.action,
            border: `1px solid ${vars.border.default}`,
            ":hover": {
                backgroundColor: vars.surface.secondary,
            },
        },
    ]),
};
