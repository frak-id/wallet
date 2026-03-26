import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const statCardStyles = {
    container: style({
        display: "flex",
        flexDirection: "column",
        gap: alias.spacing.xs,
        padding: alias.spacing.s,
        borderRadius: alias.cornerRadius.l,
        backgroundColor: vars.surface.tertiary,
        flex: "1",
        minWidth: "0",
    }),
    amount: style({
        fontSize: "16px",
        fontWeight: 600,
        color: vars.text.disabled,
        lineHeight: "26px",
    }),
    amountHighlighted: style({
        fontSize: "16px",
        fontWeight: 600,
        color: vars.text.success,
        lineHeight: "26px",
    }),
    labelRow: style({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: alias.spacing.xxs,
    }),
    icon: style({
        display: "flex",
        alignItems: "center",
        color: vars.text.secondary,
    }),
};
