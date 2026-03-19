import { style } from "@vanilla-extract/css";
import { brand } from "@/tokens.css";

export const pairingHeader = style({
    marginBottom: brand.scale[400],
});

export const pairingHeaderText = style({
    textAlign: "center",
    margin: `${brand.scale[200]} 0 ${brand.scale[400]} 0`,
});
