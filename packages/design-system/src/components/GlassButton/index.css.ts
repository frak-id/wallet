import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";

export const glassCircle = style({
    position: "relative",
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    border: "none",
    background: "none",
    padding: 0,
    color: "inherit",
    borderRadius: "9999px",
    // Transparent when idle so the ring never shifts layout. `:focus-visible`
    // keeps pointer taps ring-free; the parent form covers the span variant
    // nested in a focusable `<Back>` wrapper, where the wrapper holds focus.
    outline: "2px solid transparent",
    outlineOffset: 2,
    selectors: {
        "&:focus-visible, :focus-visible > &": {
            outlineColor: vars.border.focus,
        },
    },
});

export const glassCircleDisabled = style({
    color: vars.text.disabled,
    cursor: "not-allowed",
    pointerEvents: "none",
});

export const glassIcon = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
});

// Lightning CSS strips the vendor `blur(var(--frost-blur-radius))`, so the
// constant (3) is restated in build-time CSS (a runtime <style> hits the Tauri
// CSP). Unprefixed only: adding `-webkit-` collapses to it, and Chrome ignores it.
globalStyle(`${glassCircle} .liquid-glass::after`, {
    backdropFilter: "blur(3px)",
});
