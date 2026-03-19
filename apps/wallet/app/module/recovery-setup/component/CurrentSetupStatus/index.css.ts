import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";

export const addressValue = style({
    fontFamily: "monospace",
    color: vars.text.secondary,
    wordBreak: "break-all",
});
