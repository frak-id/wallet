import { vars } from "@frak-labs/design-system/theme";
import { brand, transition, zIndex } from "@frak-labs/design-system/tokens";
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

export const toastWarning = style({
    paddingRight: brand.scale[800],
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
