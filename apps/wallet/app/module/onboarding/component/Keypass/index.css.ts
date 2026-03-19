import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const keypass = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
    padding: `${alias.spacing.l} ${brand.scale[500]}`,
});
