import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { alias } from "@/tokens.css";

export const statCardStyles = {
    container: style({
        display: "flex",
        flexDirection: "column",
        gap: alias.spacing.xs,
        padding: alias.spacing.s,
        borderRadius: alias.cornerRadius.l,
        border: `1px solid ${vars.border.subtle}`,
        backgroundColor: vars.surface.elevated,
        flex: "1",
        minWidth: "0",
    }),
    amount: style({
        fontSize: "18px",
        fontWeight: 700,
        color: vars.text.primary,
        lineHeight: "1.2",
    }),
    amountHighlighted: style({
        fontSize: "18px",
        fontWeight: 700,
        color: vars.text.success,
        lineHeight: "1.2",
    }),
    labelRow: style({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: alias.spacing.xs,
    }),
    label: style({
        fontSize: "13px",
        color: vars.text.tertiary,
    }),
    icon: style({
        display: "flex",
        alignItems: "center",
        color: vars.text.tertiary,
    }),
};
