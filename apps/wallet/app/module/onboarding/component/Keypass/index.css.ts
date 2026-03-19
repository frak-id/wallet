import { style } from "@vanilla-extract/css";
import { alias, brand } from "@/tokens.css";

export const keypass = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
    padding: `${alias.spacing.l} ${brand.scale[500]}`,
});
