import { style } from "@vanilla-extract/css";

/**
 * Local replacements for the deleted wallet-shared `Toast` + `Warning`
 * components. Styles are ported 1:1 from the originals so the dismissible
 * "stuck mutation" toast keeps its exact dark glass appearance with the
 * floating close button.
 */

export const toast = style({
    position: "relative",
    zIndex: 1000,
    maxWidth: "90vw",
    width: "auto",
});

export const warning = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "10px",
    padding: "9px 12px",
    paddingRight: "50px",
    borderRadius: "var(--frak-radius-s)",
    background: "rgba(0, 0, 0, 0.35)",
    backdropFilter: "blur(80px)",
    color: "var(--frak-color-white)",
    fontSize: "13px",
});

export const warningGlyph = style({
    fontFamily:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiOne Mozilla", "Twemoji Mozilla", "Noto Emoji", "Segoe UI Symbol", EmojiSymbols, emoji, sans-serif',
    fontSize: "12px",
});

export const dismissButton = style({
    position: "absolute",
    top: "50%",
    right: "10px",
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    background: "rgba(255, 255, 255, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "6px",
    color: "var(--frak-color-white)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    flexShrink: 0,
    selectors: {
        "&:hover": {
            background: "rgba(255, 255, 255, 0.3)",
            borderColor: "rgba(255, 255, 255, 0.4)",
        },
    },
});

export const toastStuckButton = style({
    all: "unset",
    color: "white",
    textDecoration: "underline",
    cursor: "pointer",
});

export const toastStuckLink = style({
    all: "unset",
    color: "var(--frak-color-primary) !important",
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: 600,
});
