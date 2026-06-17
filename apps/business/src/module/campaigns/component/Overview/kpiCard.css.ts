import { vars } from "@frak-labs/design-system/theme";
import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

// Lets the KPI Card shrink inside the `repeat(N, minmax(0,1fr))` grid; the DS
// Card supplies surface/radius/padding.
export const cell = style({
    minWidth: 0,
});

export const amount = style({
    fontSize: "32px",
    lineHeight: "40px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.primary,
    fontVariantNumeric: "tabular-nums",
});

export const amountEmpty = style([amount, { color: vars.text.disabled }]);

export const hint = style({
    color: vars.text.disabled,
    fontStyle: "italic",
});
