import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const pairingHeader = style({
    marginBottom: brand.scale[400],
});

export const pairingHeaderText = style({
    textAlign: "center",
    margin: `${brand.scale[200]} 0 ${brand.scale[400]} 0`,
});
