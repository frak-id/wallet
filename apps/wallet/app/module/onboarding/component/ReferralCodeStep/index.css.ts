import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

// Label and error caption sit inside the input's own gutter so they align
// with the placeholder/typed text (inset 16 from the input edge).
export const labelRow = style({
    paddingInline: alias.spacing.m,
});

export const errorRow = style({
    paddingInline: alias.spacing.m,
});

export { clearButton } from "@/module/common/styles/touchTarget.css";
