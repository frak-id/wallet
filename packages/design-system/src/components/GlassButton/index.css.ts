import { style } from "@vanilla-extract/css";
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

// Frosted disc: a tinted face with an inner glow over a 3px backdrop blur. The
// blur sits on `::after` at z-index -1, which `isolation` keeps inside the disc.
export const glass = style({
    position: "relative",
    isolation: "isolate",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 22,
    boxShadow: "0 6px 24px rgba(0, 0, 0, 0.2)",
    "::before": {
        content: '""',
        position: "absolute",
        inset: 0,
        zIndex: 0,
        borderRadius: "inherit",
        boxShadow: "inset 0 0 15px -5px #ffffff",
        backgroundColor: "rgba(247, 247, 247, 0.8)",
    },
    "::after": {
        content: '""',
        position: "absolute",
        inset: 0,
        zIndex: -1,
        borderRadius: "inherit",
        backdropFilter: "blur(3px)",
    },
});

export const glassIcon = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
});
