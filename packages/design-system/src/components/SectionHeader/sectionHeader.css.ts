import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";

export const sectionHeaderStyles = {
    container: style({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
    }),
    title: style({
        fontSize: "28px",
        fontWeight: 700,
        color: vars.text.primary,
        margin: "0",
    }),
};
