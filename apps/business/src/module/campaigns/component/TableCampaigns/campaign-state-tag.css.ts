import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

/** Draft tag reads quieter than the other states: tertiary text on muted. */
export const draftTag = style({
    color: vars.text.tertiary,
});
