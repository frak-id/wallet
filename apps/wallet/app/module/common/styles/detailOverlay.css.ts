import { vars } from "@frak-labs/design-system/theme";
import { zIndex } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

const fadeIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const fadeOut = keyframes({
    from: { opacity: 1 },
    to: { opacity: 0 },
});

const overlayBase = style({
    position: "fixed",
    inset: 0,
    zIndex: zIndex.modal,
    backgroundColor: vars.surface.background,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
});

export const overlay = style([
    overlayBase,
    { animation: `${fadeIn} 0.25s ease-out both` },
]);

export const overlayClosing = style([
    overlayBase,
    { animation: `${fadeOut} 0.2s ease-in both` },
]);
