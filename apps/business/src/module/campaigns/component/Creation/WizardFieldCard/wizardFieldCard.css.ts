import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Inset the header text by 16px so it lines up with the text inside a 56/68px
 * input field (used by the title + merchant cards). Flush otherwise.
 */
export const inset = style({
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.m,
});
