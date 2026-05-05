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

// Targets the overlay's direct child — render a single element from the
// `DetailOverlay` render-prop (no fragments / sibling wrappers).
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

// Bottom-sheet variant: mobile shows a dark backdrop with the sheet
// pushed down by `spacing.l` so its top-rounded corners remain visible.
// Desktop falls back to the same centred-card layout as the fullScreen
// variant so the overlay still reads as a modal at large breakpoints.
const bottomSheetBase = style({
    position: "fixed",
    inset: 0,
    zIndex: zIndex.modal,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    "@media": {
        "screen and (min-width: 1024px)": {
            alignItems: "center",
            justifyContent: "center",
            padding: alias.spacing.l,
            overflow: "hidden",
        },
    },
});

// Targets the overlay's direct child — render a single element from the
// `DetailOverlay` render-prop. Fragments / sibling wrappers would each
// pick up these rounded-corner / max-height styles independently and
// break the layout.
globalStyle(`${bottomSheetBase} > *`, {
    backgroundColor: vars.surface.background2,
    borderTopLeftRadius: alias.cornerRadius.xl,
    borderTopRightRadius: alias.cornerRadius.xl,
    width: "100%",
    marginTop: alias.spacing.l,
    // Mobile: fill the viewport minus the backdrop strip so the sheet
    // reads as a near-full bottom drawer. Desktop overrides this to
    // content-height so short content (e.g. the edit form) doesn't
    // stretch the card to 90dvh.
    minHeight: `calc(100dvh - ${alias.spacing.l})`,
    maxHeight: `calc(100dvh - ${alias.spacing.l})`,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    "@media": {
        "screen and (min-width: 1024px)": {
            marginTop: 0,
            minHeight: 0,
            maxWidth: "560px",
            maxHeight: "90dvh",
            borderRadius: alias.cornerRadius.xl,
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
        },
    },
});

export const bottomSheetOverlay = style([
    bottomSheetBase,
    { animation: `${fadeIn} 0.25s ease-out both` },
]);

export const bottomSheetClosing = style([
    bottomSheetBase,
    { animation: `${fadeOut} 0.2s ease-in both` },
]);
