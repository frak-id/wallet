import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const emptyStateStyles = {
    container: style({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: alias.spacing.m,
        padding: alias.spacing.l,
        textAlign: "center",
        width: "100%",
    }),
    iconWrapper: style({
        color: vars.icon.tertiary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    }),
    title: style({
        fontSize: "18px",
        fontWeight: 700,
        color: vars.text.primary,
        margin: "0",
    }),
    description: style({
        fontSize: "14px",
        color: vars.text.tertiary,
        margin: "0",
        lineHeight: "1.5",
    }),
    actionWrapper: style({
        width: "100%",
        maxWidth: "320px",
    }),
};
