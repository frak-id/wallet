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
    // Skip rendering + layout for cards outside the viewport (cheap virtualization
    // without a library). `auto` lets the browser cache the real size after the
    // first paint, so the placeholder height only matters for not-yet-rendered
    // cards — kept close to the actual card height to avoid scrollbar jumps.
    contentVisibility: "auto",
    containIntrinsicSize: "auto 260px",
});

export const imageWrapper = style({
    display: "flex",
    position: "relative",
    width: "100%",
    overflow: "visible",
    // Placeholder tint shown behind the hero while it lazy-loads (and under the
    // transparent PNG edges of logos), so a slow image doesn't flash empty.
    backgroundColor: vars.surface.disabled,
});

export const heroImage = style({
    width: "100%",
    height: "100%",
    objectFit: "cover",
    // Figma spec: 361 × 158.5 hero — pin the aspect ratio so every card shares
    // a consistent height regardless of the source image dimensions.
    aspectRatio: "361 / 158.5",
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

/**
 * View count in the title row (a top-aligned `Spread` slot). Matching the
 * name's line box (body = 26px) and centring within it keeps the count on the
 * optical centre of the first name line, however many lines the name wraps to.
 */
export const viewsCount = style({
    flexShrink: 0,
    color: vars.text.secondary,
    minHeight: "26px",
});

export const contentWrapper = style({
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    padding: alias.spacing.m,
});

export const imagePlaceholder = style({
    width: "100%",
    // Match the hero's aspect ratio so image-less merchants still get a full
    // band (keeps card height consistent and the white favorite heart legible).
    aspectRatio: "361 / 158.5",
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
