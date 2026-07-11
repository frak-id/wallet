import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

// Frames the client-rendered QR SVG on a white card so it scans reliably
// regardless of the surrounding surface tone. The `qr` package emits an SVG
// with a `viewBox` but NO intrinsic width/height, so without an explicit box
// size the browser falls back to the 300×150 replaced-element default and the
// code renders squashed. Take the full container width and stay square via
// `aspect-ratio` so it scales with the layout instead of a fixed size.
export const qrFrame = style({
    boxSizing: "border-box",
    width: "100%",
    aspectRatio: "1 / 1",
    padding: alias.spacing.s,
    background: "#fff",
    borderRadius: alias.cornerRadius.m,
    border: `1px solid ${vars.border.subtle}`,
    // The injected SVG is sized to fill this box by the component (its style
    // attribute) — vanilla-extract can't target a descendant `& svg` and
    // globalStyle is disallowed here.
});

// Enrolling step layout (QR + manual key side-by-side, §5 deliverable 5):
// the QR gets a fixed, non-shrinking width so it stays legibly scannable
// without stretching to fill the row; the manual key takes the remaining
// space and carries a min-width so `Inline`'s wrap collapses the pair to
// stacked once both no longer fit on one line.
export const qrColumn = style({
    flexShrink: 0,
    width: "180px",
});

export const manualColumn = style({
    flexGrow: 1,
    minWidth: "200px",
});

// Recovery codes: a monospace, selectable grid the user is meant to copy or
// save. Two columns so ten codes stay compact.
export const codesBox = style({
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: alias.spacing.xs,
    padding: alias.spacing.m,
    background: vars.surface.muted,
    borderRadius: alias.cornerRadius.m,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    userSelect: "all",
});

export const code = style({
    fontFamily: "inherit",
    fontSize: "14px",
    letterSpacing: "0.04em",
    color: vars.text.primary,
});
