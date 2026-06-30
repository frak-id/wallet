import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Local replacements for the deleted wallet-shared `Toast` + `Warning`
 * components — the dismissible "stuck mutation" toast with a floating
 * close button.
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
    borderRadius: alias.cornerRadius.s,
    background: vars.surface.elevated,
    border: `1px solid ${vars.border.subtle}`,
    boxShadow: "0 8px 24px -8px #00000026",
    color: vars.text.primary,
    fontSize: "13px",
});

export const warningContent = style({
    margin: 0,
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
    background: vars.surface.muted,
    border: `1px solid ${vars.border.default}`,
    borderRadius: "6px",
    color: vars.text.secondary,
    cursor: "pointer",
    transition: "all 0.2s ease",
    flexShrink: 0,
    selectors: {
        "&:hover": {
            background: vars.surface.disabled,
            borderColor: vars.border.focus,
        },
    },
});

export const toastStuckButton = style({
    all: "unset",
    color: vars.text.action,
    textDecoration: "underline",
    cursor: "pointer",
});

export const toastStuckLink = style({
    all: "unset",
    color: `${vars.text.action} !important`,
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: 600,
});
