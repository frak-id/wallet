import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";

export const button = style({
    marginTop: "12px",
    width: "100%",
});

export const addressValue = style({
    fontFamily: "monospace",
    color: vars.text.secondary,
    wordBreak: "break-all",
});
