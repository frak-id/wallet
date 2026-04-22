import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const cardWrapper = style({
    display: "flex",
    flexDirection: "column",
    borderRadius: alias.cornerRadius.l,
    backgroundColor: vars.surface.elevated,
    overflow: "hidden",
    cursor: "pointer",
});

export const imageWrapper = style({
    display: "flex",
    position: "relative",
    width: "100%",
    overflow: "visible",
});

export const heroImage = style({
    width: "100%",
    height: "100%",
    objectFit: "cover",
    // Figma spec: 361 × 158.5 hero — pin the aspect ratio so every card shares
    // a consistent height regardless of the source image dimensions.
    aspectRatio: "361 / 158.5",
});

export const badge = style({
    position: "absolute",
    top: 17,
    right: 17,
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    padding: "4px 8px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(16px)",
    color: vars.text.primary,
});

export const logoWrapper = style({
    position: "absolute",
    bottom: "-12px",
    left: alias.spacing.m,
    width: 42,
    height: 42,
    zIndex: 1,
});

/**
 * Container for the SVG cutout shape that sits behind the logo.
 * Positioned so the SVG's circle center aligns with the logo's center.
 */
export const logoCutoutContainer = style({
    position: "absolute",
    left: 7.3,
    bottom: "-13.5px",
    width: 59,
    height: 47,
    zIndex: 1,
    color: vars.surface.elevated,
    pointerEvents: "none",
});

export const logoImage = style({
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%",
});

export const contentWrapper = style({
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    padding: alias.spacing.m,
});

export const merchantName = style({
    fontSize: 16,
    fontWeight: 600,
    color: vars.text.primary,
    lineHeight: 1.3,
});

export const imagePlaceholder = style({
    width: "100%",
    height: "100%",
    backgroundColor: vars.surface.disabled,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

/**
 * Single-line fallback used when no reward is available — keeps the card
 * bottom line consistent in height with the reward variant.
 */
export const descriptionFallback = style({
    display: "-webkit-box",
    WebkitLineClamp: 1,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: vars.text.secondary,
});
