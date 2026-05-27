import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias } from "../../tokens.css";

export const funnelChartStyles = {
    container: style({
        display: "flex",
        flexDirection: "column",
        gap: alias.spacing.m,
        width: "100%",
        position: "relative",
    }),
    // Vertical dotted guides at 25/50/75/100% of the bar column, drawn
    // by absolutely positioned `<span>` children using a real
    // `border-left: 1px dotted` so the dots render crisp instead of
    // pixel-doubled like a background gradient would.
    guides: style({
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `calc(120px + ${alias.spacing.m})`,
        right: `calc(96px + ${alias.spacing.m})`,
        pointerEvents: "none",
    }),
    guide: style({
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width: 0,
        borderLeft: `1px dotted ${vars.border.default}`,
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
