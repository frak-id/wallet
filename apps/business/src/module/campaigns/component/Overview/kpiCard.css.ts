import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

// Lets the KPI Card shrink inside the `repeat(N, minmax(0,1fr))` grid; the DS
// Card supplies surface/radius/padding.
export const cell = style({
    minWidth: 0,
});

export const amount = style({
    fontSize: "32px",
    lineHeight: "40px",
    fontWeight: 600,
    color: vars.text.primary,
    fontVariantNumeric: "tabular-nums",
});

export const hint = style({
    color: vars.text.disabled,
    fontStyle: "italic",
});
