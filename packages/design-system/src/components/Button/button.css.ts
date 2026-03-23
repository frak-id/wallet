import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, fontSize } from "../../tokens.css";

const base = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.s,
    width: "100%",
    borderRadius: alias.cornerRadius.full,
    cursor: "pointer",
    border: "none",
    textDecoration: "none",
    transition: "background-color 0.2s ease",
    ":focus": {
        outline: "none",
    },
});

const small = style({
    padding: `${alias.spacing.m}`,
    fontSize: fontSize.s,
});

const large = style({
    padding: `${alias.spacing.l}`,
    fontSize: fontSize.m,
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
    size: {
        small,
        large,
    },
};
