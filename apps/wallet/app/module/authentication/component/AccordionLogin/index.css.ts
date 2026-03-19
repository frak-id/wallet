import { vars } from "@frak-labs/design-system/theme";
import { brand, fontSize } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const accordionLogin__trigger = style({
    display: "flex",
    alignItems: "center",
    gap: brand.scale[300],
    color: vars.text.primary,
    fontWeight: brand.typography.fontWeight.regular,
    fontSize: fontSize.s,
});

export const accordionLogin__content = style({
    marginRight: `calc(-1 * ${brand.scale[300]})`,
});

globalStyle(`${accordionLogin__content} > div`, {
    marginTop: brand.scale[500],
});
