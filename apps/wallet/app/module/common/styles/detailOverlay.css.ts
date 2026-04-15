import { vars } from "@frak-labs/design-system/theme";
import { alias, zIndex } from "@frak-labs/design-system/tokens";
import { globalStyle, keyframes, style } from "@vanilla-extract/css";

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
    "@media": {
        "screen and (min-width: 1024px)": {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: alias.spacing.l,
            overflow: "hidden",
        },
    },
});

globalStyle(`${overlayBase} > *`, {
    "@media": {
        "screen and (min-width: 1024px)": {
            minHeight: 0,
            width: "100%",
            maxWidth: "560px",
            maxHeight: "90dvh",
            borderRadius: alias.cornerRadius.xl,
            overflow: "auto",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
        },
    },
});

export const overlay = style([
    overlayBase,
    { animation: `${fadeIn} 0.25s ease-out both` },
]);

export const overlayClosing = style([
    overlayBase,
    { animation: `${fadeOut} 0.2s ease-in both` },
]);
