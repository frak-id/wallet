import { style } from "@vanilla-extract/css";

/**
 * Reserve a fixed label height (bottom-anchored) so fields laid out side by
 * side stay aligned when one label wraps to more lines than another. The
 * concrete `min-height` is set inline from `reserveLabelLines`.
 */
export const labelReserve = style({
    display: "flex",
    alignItems: "flex-end",
});
