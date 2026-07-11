import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

// Frames the client-rendered QR SVG on a white card so it scans reliably
// regardless of the surrounding surface tone.
export const qrFrame = style({
    alignSelf: "flex-start",
    padding: alias.spacing.s,
    background: "#fff",
    borderRadius: alias.cornerRadius.m,
    border: `1px solid ${vars.border.subtle}`,
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
