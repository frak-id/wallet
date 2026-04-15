import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "../theme.css";
import { alias, brand, fontSize } from "../tokens.css";

/**
 * Shared in-app browser banner styles.
 *
 * Used by:
 * - `sdk/components` → `<frak-banner>` (Preact Web Component on merchant sites)
 * - `packages/wallet-shared` → `<InAppBrowserToast>` (React in wallet/listener apps)
 *
 * Both render the same dark translucent alert when the page is opened inside a
 * social-media in-app browser (Instagram, Facebook WebView).
 */

const fadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const container = style({
    position: "fixed",
    top: `max(${alias.spacing.xs}, env(safe-area-inset-top))`,
    left: alias.spacing.m,
    right: alias.spacing.m,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    paddingRight: alias.spacing.xl,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: "#000000CC",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: "#ffffff",
    animation: `${fadeIn} 300ms ease-out`,
});

export const header = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const iconWrapper = style({
    flexShrink: 0,
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
});

export const title = style({
    margin: 0,
    padding: 0,
    fontSize: fontSize.m,
    fontWeight: brand.typography.fontWeight.medium,
    lineHeight: "26px",
    color: vars.text.onAction,
});

export const body = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: `0 ${alias.spacing.xxs}`,
});

export const description = style({
    margin: 0,
    padding: 0,
    fontSize: fontSize.s,
    color: vars.text.onAction,
    lineHeight: "22px",
    opacity: 0.96,
});

export const cta = style({
    all: "unset",
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    color: "#2BB2FF",
    fontSize: fontSize.s,
    fontWeight: brand.typography.fontWeight.semiBold,
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    cursor: "pointer",
    selectors: {
        "&:focus-visible": {
            outline: "2px solid #2BB2FF",
            outlineOffset: "2px",
            borderRadius: alias.cornerRadius.xs,
        },
    },
});

export const closeButton = style({
    all: "unset",
    position: "absolute",
    top: alias.spacing.xs,
    right: alias.spacing.xs,
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: alias.cornerRadius.full,
    color: "rgba(255, 255, 255, 0.6)",
    cursor: "pointer",
    selectors: {
        "&:focus-visible": {
            outline: "2px solid #ffffff",
            outlineOffset: "2px",
        },
    },
});
