import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const pairingStatus = style({
    display: "inline-block",
});

export const statusInline = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: brand.scale[100],
});
