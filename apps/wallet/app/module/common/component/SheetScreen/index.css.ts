import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** No vertical padding: the toolbar adds `pb-xs` and the footer owns its spacing. */
export const bodyStack = style({
    paddingInline: alias.spacing.m,
    flexGrow: 1,
});
