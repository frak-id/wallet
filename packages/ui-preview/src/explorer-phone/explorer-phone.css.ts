import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Device-frame geometry comes from the exported phone artwork (353×735,
 * 322-wide screen inset 15.5px / 17px) — no DS token applies to these px.
 */
export const phoneShell = style({
    position: "relative",
    width: 353,
    height: 735,
    filter: "drop-shadow(0 24px 48px rgba(0, 0, 0, 0.24))",
});

/**
 * Screen surface — clips every content layer to the display's rounded
 * corners so nothing paints over the bezel.
 */
export const screen = style({
    position: "absolute",
    top: 17,
    left: 15.5,
    width: 322,
    height: 701,
    borderRadius: 45,
    overflow: "hidden",
});

/**
 * Hero image area covering the frame artwork's placeholder screen window.
 * Horizontal scroll-snap track mirroring the wallet's hero carousel.
 */
export const hero = style({
    position: "absolute",
    top: 0,
    left: 0,
    display: "flex",
    width: "100%",
    height: 190,
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    scrollbarWidth: "none",
    "::-webkit-scrollbar": {
        display: "none",
    },
});

export const heroSlide = style({
    flex: "0 0 100%",
    height: "100%",
    scrollSnapAlign: "start",
    backgroundColor: alias.neutral[200],
    backgroundSize: "cover",
    backgroundPosition: "center",
});

export const heroCount = style({
    position: "absolute",
    top: 144,
    right: 13,
    paddingInline: 6,
    paddingBlock: 2,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    color: alias.neutral.white,
    fontSize: 9,
    lineHeight: "14px",
    fontWeight: brand.typography.fontWeight.medium,
});

/**
 * Dark overlay improving status-bar legibility over light merchant images
 * (the placeholder artwork already bakes it in).
 */
export const heroDimmed = style({
    position: "relative",
    "::after": {
        content: "",
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.12)",
    },
});

/**
 * Dynamic-island pill redrawn above the hero (the artwork's own island
 * sits under the hero overlay).
 */
export const notch = style({
    position: "absolute",
    top: 11,
    left: "50%",
    transform: "translateX(-50%)",
    width: 94,
    height: 28,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: alias.neutral.default,
});

/**
 * Device frame artwork — bezel, screen body and baked-in CTA. The screen
 * window holds a placeholder pattern, so the hero layer renders on top.
 */
export const frameImage = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    pointerEvents: "none",
});

/**
 * Toolbar over the hero: scroll-edge fade, iOS status bar and glass
 * controls, mirroring the wallet's top chrome.
 */
export const toolbar = style({
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    paddingBottom: 6.55,
    background:
        "linear-gradient(180deg, rgba(249, 250, 251, 0.85) 0%, rgba(249, 250, 251, 0) 100%)",
    // Decorative chrome — let hero swipes pass through.
    pointerEvents: "none",
});

export const statusBar = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: 13.11,
    paddingBlock: 9.01,
});

export const statusTime = style({
    width: 95.45,
    textAlign: "center",
    fontSize: 13.93,
    lineHeight: "18.03px",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.onAction,
});

export const statusLevels = style({
    width: 95.45,
    height: 18.03,
    display: "block",
});

export const controls = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingInline: 13.11,
});

export const glassButton = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36.05,
    height: 36.05,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: "rgba(247, 247, 247, 0.9)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    color: vars.icon.secondary,
});

/**
 * Bottom sheet — rounded top overlapping the hero, background merging
 * seamlessly with the frame's screen body. Stops above the baked CTA.
 */
export const sheet = style({
    position: "absolute",
    top: 170,
    left: 0,
    width: "100%",
    bottom: 83,
    display: "flex",
    flexDirection: "column",
    gap: 13.11,
    paddingTop: 19.66,
    paddingInline: 13.11,
    borderRadius: "19.66px 19.66px 0 0",
    backgroundColor: vars.surface.background2,
    overflow: "hidden",
});

export const sheetHeader = style({
    display: "flex",
    alignItems: "flex-start",
    gap: 13.11,
});

export const sheetTitles = style({
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6.55,
});

export const merchantName = style({
    fontSize: 22.94,
    lineHeight: "31.14px",
    fontWeight: brand.typography.fontWeight.bold,
    color: vars.text.primary,
    overflowWrap: "break-word",
});

export const rewardText = style({
    fontSize: 13.11,
    lineHeight: "21.3px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.primary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const logo = style({
    flexShrink: 0,
    width: 39.33,
    height: 39.33,
    borderRadius: alias.cornerRadius.full,
    objectFit: "cover",
});

export const logoPlaceholder = style({
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 39.33,
    height: 39.33,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: alias.neutral[250],
    fontSize: 10,
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.disabled,
});

/**
 * White description card inside the sheet.
 */
export const descriptionCard = style({
    display: "flex",
    flexDirection: "column",
    gap: 6.55,
    padding: 13.11,
    borderRadius: 13.11,
    backgroundColor: vars.surface.elevated,
});

export const descriptionText = style({
    fontSize: 11.47,
    lineHeight: "18.03px",
    color: vars.text.primary,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 8,
    overflow: "hidden",
});

export const readMore = style({
    fontSize: 11.47,
    lineHeight: "18.03px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.action,
});
