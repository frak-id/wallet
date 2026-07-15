import { vars } from "@frak-labs/design-system/theme";
import {
    brand,
    fontSize,
    transition,
    zIndex,
} from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

const toastIn = keyframes({
    "0%": { opacity: 0, transform: "translateY(6px) scale(0.98)" },
    "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
});

export const toast = style({
    position: "relative",
    zIndex: zIndex.toast,
    maxWidth: "90vw",
    width: "auto",
    animation: `${toastIn} ${transition.base} ease-out`,
});

export const toastLoading = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: brand.scale[200],
});

export const toastClickable = style({
    all: "unset",
    display: "block",
    cursor: "pointer",
    transition: `transform ${transition.base} ease`,
    selectors: {
        "&:hover": {
            transform: "scale(1.02)",
        },
        "&:active": {
            transform: "scale(0.98)",
        },
    },
});

export const toastActions = style({
    position: "absolute",
    top: "50%",
    right: "10px",
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: brand.scale[200],
});

// Reproduces the deleted local `Warning` component's look (tint, radius,
// padding, spacing, text color) on top of the DS `Notice`, plus the extra
// right padding this toast needs to clear the absolute dismiss button.
// Reproduces the old `Badge`-based Warning exactly. `&&` doubles specificity so
// these beat `Notice`'s inline recipe regardless of stylesheet insertion order.
// `white-space: nowrap` + `font-weight: 600` were inherited from `Badge` base.
export const toastNotice = style({
    selectors: {
        "&&": {
            alignItems: "center",
            justifyContent: "center",
            marginBottom: brand.scale[200],
            paddingTop: brand.scale[200],
            paddingBottom: brand.scale[200],
            paddingLeft: brand.scale[300],
            paddingRight: brand.scale[800],
            borderRadius: brand.scale[200],
            color: vars.text.primary,
            whiteSpace: "nowrap",
            fontWeight: 600,
        },
    },
});

export const toastNoticeText = style({
    fontFamily:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiOne Mozilla", "Twemoji Mozilla", "Noto Emoji", "Segoe UI Symbol", EmojiSymbols, emoji, sans-serif',
    fontSize: fontSize.xs,
});

export const toastDismissButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: brand.scale[400],
    height: brand.scale[400],
    background: vars.surface.muted,
    border: `1px solid ${vars.border.default}`,
    borderRadius: brand.scale[300],
    color: vars.text.primary,
    cursor: "pointer",
    transition: `all ${transition.base} ease`,
    flexShrink: 0,
    selectors: {
        "&:hover": {
            background: vars.surface.tertiary,
            borderColor: vars.border.subtle,
        },
    },
});
