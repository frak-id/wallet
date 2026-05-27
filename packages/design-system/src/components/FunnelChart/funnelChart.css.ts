import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const funnelChartStyles = {
    container: style({
        display: "flex",
        flexDirection: "column",
        gap: alias.spacing.m,
        width: "100%",
    }),
    row: style({
        display: "grid",
        gridTemplateColumns: "120px 1fr 96px",
        alignItems: "center",
        columnGap: alias.spacing.m,
    }),
    label: style({
        fontSize: "13px",
        lineHeight: "16px",
        color: vars.text.secondary,
    }),
    track: style({
        position: "relative",
        height: "20px",
        backgroundColor: vars.surface.muted,
        borderRadius: alias.cornerRadius.xs,
        overflow: "hidden",
    }),
    bar: style({
        height: "100%",
        backgroundColor: vars.icon.action,
        borderRadius: alias.cornerRadius.xs,
        transition: "width 240ms ease-out",
    }),
    barSuccess: style({
        backgroundColor: vars.icon.success,
        borderRadius: alias.cornerRadius.xs,
    }),
    valueCell: style({
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "2px",
    }),
    value: style({
        fontSize: "14px",
        fontWeight: 600,
        color: vars.text.primary,
        lineHeight: "16px",
        fontVariantNumeric: "tabular-nums",
    }),
    delta: style({
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        fontSize: "11px",
        fontWeight: 500,
        lineHeight: "12px",
    }),
    deltaUp: style({ color: vars.text.success }),
    deltaDown: style({ color: vars.text.warning }),
};
