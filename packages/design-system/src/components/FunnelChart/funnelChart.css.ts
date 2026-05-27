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
        fontSize: "14px",
        lineHeight: "22px",
        color: vars.text.tertiary,
    }),
    track: style({
        position: "relative",
        height: "16px",
        backgroundColor: vars.surface.muted,
        borderRadius: "2px",
        overflow: "hidden",
    }),
    bar: style({
        height: "100%",
        backgroundColor: vars.icon.action,
        borderRadius: "2px",
        transition: "width 240ms ease-out",
    }),
    barSuccess: style({
        backgroundColor: vars.icon.success,
        borderRadius: "2px",
    }),
    valueCell: style({
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "2px",
    }),
    value: style({
        fontSize: "14px",
        lineHeight: "22px",
        color: vars.text.primary,
        fontVariantNumeric: "tabular-nums",
    }),
    delta: style({
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        lineHeight: "20px",
    }),
    deltaUp: style({ color: vars.text.success }),
    deltaDown: style({ color: vars.text.warning }),
};
