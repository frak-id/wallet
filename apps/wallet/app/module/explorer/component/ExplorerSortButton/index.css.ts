import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Wraps the glass button so the red dot can be pinned over it; also sets the
 * grey sorting-glyph colour the glass icon inherits. `pointer-events: auto`
 * restores interactivity inside the click-through sticky action row. */
export const wrapper = style({
    position: "relative",
    display: "inline-flex",
    color: vars.icon.secondary,
    pointerEvents: "auto",
    // Sit above the scroll-edge blur layers pinned behind the header.
    zIndex: 1,
});

/**
 * Red "sorted" indicator: an 8×8 footprint pinned to the button's top-right
 * corner, with 1.5px padding around a 5×5 error pill.
 */
export const dot = style({
    position: "absolute",
    top: 7,
    right: 7,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 8,
    height: 8,
    padding: 1.5,
    pointerEvents: "none",
});

export const dotCore = style({
    width: 5,
    height: 5,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.icon.error,
});
