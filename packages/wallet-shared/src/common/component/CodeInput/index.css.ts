import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const container = style({
    position: "relative",
    display: "flex",
    justifyContent: "center",
    gap: alias.spacing.m,
    cursor: "text",
});

export const containerFill = style({
    width: "100%",
});

export const pasteButton = style({
    alignSelf: "center",
});

/**
 * Single transparent input overlaid on the boxes. It owns the real value so the
 * browser/OS can autofill (`autocomplete="one-time-code"`), and handles caret,
 * typing and paste natively. Kept invisible — the boxes render the value.
 */
export const hiddenInput = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    margin: 0,
    padding: 0,
    border: 0,
    background: "transparent",
    color: "transparent",
    caretColor: "transparent",
    outline: "none",
    cursor: "text",
    // The input is absolutely positioned and stacked above the boxes (zIndex),
    // so it transparently covers the whole row and is the natural tap target.
    zIndex: 1,
    // iOS keyboard reliability: keep the input selectable (WebKit won't open the
    // soft keyboard for an input that resolves to -webkit-user-select: none),
    // and >=16px font so focus doesn't trigger the auto-zoom jump.
    userSelect: "text",
    WebkitUserSelect: "text",
    fontSize: 16,
});

export const digitBox = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // Boxes are purely presentational — never intercept taps, so every tap
    // reaches the transparent input above them (keeps iOS keyboard working).
    pointerEvents: "none",
    width: 41,
    height: 56,
    borderRadius: alias.cornerRadius.m,
    border: `1px solid ${vars.surface.muted}`,
    background: vars.surface.muted,
    fontFamily: "inherit",
    fontSize: fontSize.xl,
    fontWeight: 600,
    textAlign: "center",
    color: vars.text.primary,
});

export const digitBoxError = style({
    background: vars.surface.error,
});

export const digitBoxActive = style({
    borderColor: vars.border.focus,
});

export const digitBoxFill = style({
    width: "auto",
    flex: "1 1 0",
    minWidth: 0,
    maxWidth: 41,
});

export const placeholder = style({
    color: vars.text.disabled,
});

export const errorMessage = style({
    color: vars.text.error,
    fontSize: fontSize.s,
    textAlign: "center",
});
