import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, brand, fontSize } from "../../tokens.css";

/**
 * Field label — matches the DS `Input`/`TextArea` composed label exactly
 * (14/22, medium, secondary colour, 16px inset).
 */
export const label = style({
    fontSize: fontSize.s,
    lineHeight: "22px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
    paddingInline: alias.spacing.m,
});

/**
 * Reserve a fixed label height (bottom-anchored) so fields laid out side by
 * side stay aligned when one label wraps to more lines than another. The
 * concrete `min-height` is set inline from `reserveLabelLines`.
 */
export const labelReserve = style({
    display: "flex",
    alignItems: "flex-end",
});

/** Field hint — matches the DS composed hint (12/20, tertiary, 16px inset). */
export const hint = style({
    fontSize: fontSize.xs,
    lineHeight: "20px",
    fontWeight: brand.typography.fontWeight.regular,
    color: vars.text.tertiary,
    paddingInline: alias.spacing.m,
});
