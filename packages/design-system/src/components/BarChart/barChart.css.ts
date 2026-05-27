import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";

export const barChartStyles = {
    container: style({
        width: "100%",
        height: "180px",
        color: vars.text.tertiary,
    }),
    avgLabel: style({
        fontSize: "11px",
        fill: vars.text.action,
        fontWeight: 500,
    }),
};
