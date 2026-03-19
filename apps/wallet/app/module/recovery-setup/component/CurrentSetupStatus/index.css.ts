import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const addressValue = style({
    fontFamily: "monospace",
    color: vars.text.secondary,
    wordBreak: "break-all",
});
