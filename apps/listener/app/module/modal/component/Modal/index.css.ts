import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { globalStyle, keyframes, style } from "@vanilla-extract/css";

/* Figma header logo — 48px tall, aspect preserved. */
export const modalHeaderLogo = style({
    display: "block",
    height: alias.size.xl,
    width: "auto",
});

/* Frak fallback mark, brand blue. */
export const modalHeaderLogoMark = style({
    color: vars.text.action,
});

/* Radix Title host (real <h2> so it registers for a11y) — reset UA margin;
 * the nested DS Text carries the heading2 typography. */
export const modalHeaderTitle = style({
    margin: 0,
});

/* Figma subtitle — Body-Primary/Regular, secondary, centered. */
export const modalListener__subtitle = style({
    margin: 0,
    fontSize: "16px",
    lineHeight: "26px",
    textAlign: "center",
    color: vars.text.secondary,
});

export const modalListener__sharingButtons = style({
    display: "flex",
    justifyContent: "center",
    gap: alias.spacing.xl,
});

export const modalListener__buttonLink = style({
    all: "unset",
    cursor: "pointer",
    textDecoration: "underline",
    display: "inline-flex",
    gap: alias.spacing.xs,
    color: vars.text.secondary,
});

/* === Modal shell styles === */

const dialogOverlayShow = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

const dialogContentShow = keyframes({
    from: { opacity: 0, transform: "scale(0.96)" },
    to: { opacity: 1, transform: "scale(1)" },
});

export const alertDialog__overlay = style({
    background: vars.surface.overlay,
    position: "fixed",
    zIndex: 210,
    inset: 0,
    animation: `${dialogOverlayShow} 250ms cubic-bezier(0.16, 1, 0.3, 1)`,
});

export const alertDialog__close = style({
    all: "unset",
    display: "flex",
    cursor: "pointer",
    color: vars.icon.secondary,
});

export const alertDialog__content = style({
    /* Centering via `translate` (independent from `transform`, so animations using transform: scale() don't conflict) */
    backgroundColor: vars.surface.background2,
    position: "fixed",
    top: "50%",
    left: "50%",
    translate: "-50% -50%",
    zIndex: 220,
    width: "calc(100vw - 32px)",
    maxWidth: "448px",
    maxHeight: "calc(100dvh - 32px)",
    boxSizing: "border-box",
    padding: alias.spacing.l,
    animation: `${dialogContentShow} 250ms cubic-bezier(0.16, 1, 0.3, 1)`,
    overflowY: "auto",
    borderRadius: alias.cornerRadius.xl,
    color: vars.text.primary,
    selectors: {
        "&:focus": {
            outline: "none",
        },
    },
});

/* Markdown-rendered descriptions contain raw <a> tags we don't author, so a
 * scoped globalStyle is the cleanest way to colour them. */
globalStyle(`${alertDialog__content} a`, {
    color: vars.text.action,
});
