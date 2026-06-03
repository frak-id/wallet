import { keyframes, style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, brand } from "../../tokens.css";

/**
 * Tone-tinted floating "alert message" card used as the WebAuthn error toast,
 * with compact and scrollable (overflowing) variants. Positioning (fixed top,
 * safe-area, z-index) is owned by the host `BannerStack`; this component only
 * paints the card surface + scroll affordances.
 */

const fadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const container = style({
    position: "relative",
    borderRadius: alias.cornerRadius.m,
    overflow: "hidden", // clip the edge-fade overlays to the rounded corners
    animation: `${fadeIn} 300ms ease-out`,
    textAlign: "left",
    width: "100%",
    pointerEvents: "auto", // re-enable inside the click-through BannerStack
});

export const containerTone = styleVariants({
    neutral: { backgroundColor: vars.surface.secondary },
    warning: { backgroundColor: vars.surface.warning },
    danger: { backgroundColor: vars.surface.error },
});

/** Inner scroll viewport — content scrolls beneath the pinned close + fades. */
export const scrollArea = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    padding: alias.spacing.m,
    maxHeight: "60vh",
    overflowY: "auto",
    overscrollBehavior: "contain",
    // Thin rounded scrollbar matching the Figma 4px / border-default bar.
    scrollbarWidth: "thin",
    scrollbarColor: `${vars.border.default} transparent`,
    selectors: {
        "&::-webkit-scrollbar": { width: "4px" },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": {
            backgroundColor: vars.border.default,
            borderRadius: alias.cornerRadius.xxl,
        },
    },
});

/** Icon + text row. */
export const row = style({
    display: "flex",
    gap: alias.spacing.xs,
    alignItems: "flex-start",
    width: "100%",
});

export const icon = style({
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    paddingBlock: "2px",
});

export const iconTone = styleVariants({
    neutral: { color: vars.icon.action }, // face-id blue
    warning: { color: vars.icon.warning },
    danger: { color: vars.icon.error },
});

export const textColumn = style({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: alias.spacing.xxs,
    flex: "1 1 0",
    minWidth: 0,
});

export const titleRow = style({
    display: "flex",
    minHeight: "26px",
    width: "100%",
    // Reserve the close button's width + gap so the title wraps at the same
    // point as Figma's inline close (close 24 + spacing.xs 8).
    paddingRight: alias.spacing.xl,
});

export const title = style({
    flex: "1 1 0",
    minWidth: 0,
    margin: 0,
    fontFamily: brand.typography.fontFamily.inter,
    fontSize: "16px",
    lineHeight: "26px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.primary,
    wordBreak: "break-word",
});

export const description = style({
    margin: 0,
    fontFamily: brand.typography.fontFamily.inter,
    fontSize: "14px",
    lineHeight: "22px",
    fontWeight: brand.typography.fontWeight.regular,
    color: vars.text.primary,
    wordBreak: "break-word",
});

export const steps = style({
    // Blank-line separation from the message (Figma renders a `<br/><br/>`
    // between the paragraph and the list); adds to the column's xxs gap.
    marginTop: alias.spacing.m,
    paddingLeft: "1.35rem",
    marginBottom: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    listStyle: "decimal",
    fontFamily: brand.typography.fontFamily.inter,
    fontSize: "14px",
    lineHeight: "22px",
    fontWeight: brand.typography.fontWeight.regular,
    color: vars.text.primary,
});

/** Bottom action row — indented to align under the text column (icon + gap). */
export const bottom = style({
    display: "flex",
    paddingLeft: alias.spacing.xl,
    width: "100%",
});

export const action = style({
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: brand.typography.fontFamily.inter,
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.semiBold,
    selectors: {
        "&:focus-visible": {
            outline: `2px solid ${vars.border.focus}`,
            outlineOffset: "2px",
            borderRadius: alias.cornerRadius.xs,
        },
    },
});

export const actionTone = styleVariants({
    neutral: { color: vars.text.action },
    warning: { color: vars.text.warning },
    danger: { color: vars.text.error },
});

/** Pinned close (X) button — stays put while content scrolls beneath it. */
export const close = style({
    position: "absolute",
    top: alias.spacing.m,
    right: alias.spacing.m,
    zIndex: 2,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    color: vars.icon.secondary,
    cursor: "pointer",
    borderRadius: alias.cornerRadius.full,
    transition: "background-color 150ms ease-out",
    selectors: {
        "&:hover": { backgroundColor: "#0000000d" },
        "&:focus-visible": {
            outline: `2px solid ${vars.border.focus}`,
            outlineOffset: "2px",
        },
    },
});

/**
 * Edge-fade overlays signalling scrollable overflow (Figma 56px gradient). Built
 * from the literal light-theme surface hexes so the fade stays the same hue as
 * the surface (a `transparent` keyword would grey-shift the gradient). The
 * bottom variant is reused for the top edge via a 180° rotation.
 */
const FADE_HEIGHT = "56px";

export const fade = style({
    position: "absolute",
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
    zIndex: 1,
    pointerEvents: "none",
    opacity: 0,
    transition: "opacity 150ms ease-out",
});

export const fadeVisible = style({ opacity: 1 });

export const fadeTop = style({ top: 0, transform: "rotate(180deg)" });
export const fadeBottom = style({ bottom: 0 });

// `to top` → opaque at the bottom edge, transparent upward (the bottom fade).
// `fadeTop` rotates 180° so the opaque edge sits at the top.
export const fadeTone = styleVariants({
    neutral: {
        backgroundImage:
            "linear-gradient(to top, #f2f6fe 0%, rgba(242,246,254,0) 100%)",
    },
    warning: {
        backgroundImage:
            "linear-gradient(to top, #fef9f2 0%, rgba(254,249,242,0) 100%)",
    },
    danger: {
        backgroundImage:
            "linear-gradient(to top, #fce8ea 0%, rgba(252,232,234,0) 100%)",
    },
});
