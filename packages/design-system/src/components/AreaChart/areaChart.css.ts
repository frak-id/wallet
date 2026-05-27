import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";

export const areaChartStyles = {
    container: style({
        width: "100%",
        height: "180px",
        color: vars.text.tertiary,
    }),
};
