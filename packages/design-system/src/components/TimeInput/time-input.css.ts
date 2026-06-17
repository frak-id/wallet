import { style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";

/**
 * Hides the browser's native time-picker indicator so the field stays cleanly
 * typeable (the visible clock icon is rendered separately). Applied to the
 * inner `<input>` via `Input`'s `inputClassName`.
 */
export const input = style({
    selectors: {
        "&::-webkit-calendar-picker-indicator": {
            display: "none",
        },
    },
});

export const icon = style({
    color: vars.icon.secondary,
    flexShrink: 0,
});
