import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { brand } from "@/tokens.css";

export const skeletonContainer = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: brand.scale[600],
});

export const skeleton = style({
    border: `1px solid ${vars.border.subtle}`,
});
