import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const tokenMaxButton = style({
    paddingBlock: alias.spacing.xxs,
    paddingInline: alias.spacing.xs,
    backgroundColor: vars.surface.secondary,
    border: "none",
    borderRadius: alias.cornerRadius.s,
    fontSize: fontSize.xs,
    cursor: "pointer",
    color: vars.text.action,
    fontWeight: brand.typography.fontWeight.semiBold,
});
