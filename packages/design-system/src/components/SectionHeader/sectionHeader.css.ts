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
        fontSize: "16px",
        fontWeight: 700,
        color: vars.text.primary,
        margin: "0",
    }),
    action: style({
        fontSize: "14px",
        color: vars.text.action,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0",
        fontFamily: "inherit",
        ":hover": {
            color: vars.text.actionHover,
        },
    }),
};
