import { style } from "@vanilla-extract/css";
import { palette } from "../page.css";

export const rating = style({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: palette.muted,
});

export const stars = style({
    display: "inline-flex",
    gap: 1,
    color: palette.ink,
});
