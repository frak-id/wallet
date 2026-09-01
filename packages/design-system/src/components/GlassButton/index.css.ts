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
    outline: "none",
    selectors: {
        "&:focus": { outline: "none" },
        "&:focus-visible": { outline: "none" },
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

// The vendor rule uses `blur(var(--frost-blur-radius))`, which Lightning CSS
// (the Safari floor) strips as invalid. Re-declared here with the static value
// (frostBlurRadius is a constant 3) so it ships in build-time CSS — a runtime
// <style> tag would be blocked by the Tauri production CSP. Only the
// unprefixed property: Lightning CSS adds the `-webkit-` prefix itself, and
// declaring both makes it collapse the pair to `-webkit-` only (Chrome
// ignores it — no blur on web).
globalStyle(`${glassCircle} .liquid-glass::after`, {
    backdropFilter: "blur(3px)",
});
