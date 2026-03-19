import { style } from "@vanilla-extract/css";
import { brand } from "@/tokens.css";

export const notice = style({
    display: "inline-flex",
    marginTop: brand.scale[300],
});
