import { globalStyle, style } from "@vanilla-extract/css";
import { brand } from "@/tokens.css";

export const grid = style({
    padding: `${brand.scale[500]} ${brand.scale[400]}`,
    display: "grid",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr auto",
    gap: "0",
    flex: 1,
});

globalStyle(`${grid} > div + div`, {
    marginTop: brand.scale[600],
});
