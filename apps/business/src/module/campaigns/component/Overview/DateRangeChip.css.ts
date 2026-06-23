import { style } from "@vanilla-extract/css";

// The shared `filter` Button hugs its content in a flex row, but here it sits
// in a flex-column Stack — stop it stretching to the full content width.
export const chipAlign = style({
    alignSelf: "flex-start",
});
