import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const ssoHeader = style({
    display: "flex",
    gap: brand.scale[300],
    alignItems: "center",
    padding: `${brand.scale[200]} ${brand.scale[300]}`,
    borderBottom: `${alias.borderWidth.s} solid ${vars.border.subtle}`,
});

export const ssoHeader__title = style({
    margin: 0,
    fontWeight: brand.typography.fontWeight.regular,
    color: vars.text.primary,
});
