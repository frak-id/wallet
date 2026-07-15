import { globalStyle, style } from "@vanilla-extract/css";

/** Flex container spreading its slots to the extremes with a minimum gap. */
export const spread = style({});

/**
 * Stop children from stretching to fill the main axis so the space-between
 * distribution is preserved regardless of intrinsic child sizing.
 */
globalStyle(`${spread} > *`, {
    flexBasis: "auto",
});
