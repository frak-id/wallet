import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Segments sit on a faded grey track with 1px notches between them. */
export const bar = style({
    display: "flex",
    gap: "1px",
    height: "4px",
    borderRadius: alias.cornerRadius.full,
    overflow: "hidden",
    backgroundColor: "rgba(187, 196, 205, 0.5)",
});

export const segment = style({
    height: "100%",
});
