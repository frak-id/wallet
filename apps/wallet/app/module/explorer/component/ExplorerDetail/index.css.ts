import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const heroOverlap = 25;
const heroBadgeBottom = `calc(${alias.spacing.m} + ${heroOverlap}px)`;

export const heroImageSheet = style({
    marginBottom: `-${heroOverlap}px`,
});

/**
 * Horizontal scroll container for the hero image carousel.
 * Follows the same scroll-snap pattern as Onboarding.
 */
export const heroSlider = style({
    display: "flex",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    overscrollBehaviorX: "contain",
    scrollbarWidth: "none",
    touchAction: "pan-x",
    WebkitOverflowScrolling: "touch",
    width: "100%",
    height: "100%",
    selectors: {
        "&::-webkit-scrollbar": {
            display: "none",
        },
    },
});

/**
 * Individual slide — fills the carousel viewport.
 * Acts as the positioning context for the blurred background fill so the
 * actual hero image can be centered with `object-fit: contain` while still
 * letting the slide cover the whole 375 px hero area.
 */
export const heroSlide = style({
    position: "relative",
    flex: "0 0 100%",
    scrollSnapAlign: "start",
    scrollSnapStop: "always",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: vars.surface.disabled,
});

/**
 * Blurred background — the same hero image scaled to cover with a heavy
 * blur and a translucent overlay so portrait/short images no longer leave
 * an empty band at the bottom of the hero area.
 */
export const heroBackground = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "blur(28px) saturate(140%)",
    transform: "scale(1.2)",
    opacity: 0.85,
    pointerEvents: "none",
});

/**
 * Subtle dark overlay on top of the blurred background so the centered hero
 * image keeps enough contrast against busy artwork.
 */
export const heroOverlay = style({
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    pointerEvents: "none",
});

/**
 * Hero image — centered inside its slide; `contain` avoids cropping while the
 * blurred background fills any remaining space.
 */
export const heroImage = style({
    position: "relative",
    zIndex: 1,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
});

/**
 * End date — bottom-left of hero, no badge background.
 */
export const endDate = style({
    position: "absolute",
    bottom: heroBadgeBottom,
    left: alias.spacing.m,
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    color: vars.text.onAction,
    opacity: 0.8,
});

/**
 * Image count badge — bottom-right of hero.
 */
export const imageCountBadge = style({
    position: "absolute",
    bottom: heroBadgeBottom,
    right: alias.spacing.m,
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    padding: "6px 10px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    backdropFilter: "blur(16px)",
    color: vars.text.onAction,
    zIndex: 1
});

/**
 * Body content area.
 * Extra bottom padding reserves room for the floating footer so the last
 * section isn't hidden behind the blurred "Partager et gagner" bar.
 */
export const bodyContent = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    margin: 0,
    paddingBottom: `calc(96px + env(safe-area-inset-bottom, 0px))`,
});

/**
 * Floating footer variant — overrides the sticky DetailSheetFooter so the
 * primary CTA hovers above content with a frosted-glass backdrop, mirroring
 * the wallet BottomTabBar aesthetic.
 */
export const floatingFooter = style({
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    backdropFilter: "blur(18px) saturate(140%)",
    WebkitBackdropFilter: "blur(18px) saturate(140%)",
    borderTop: "1px solid rgba(0, 0, 0, 0.04)",
    zIndex: 3,
    "@media": {
        "screen and (min-width: 1024px)": {
            position: "sticky",
        },
    },
});

/**
 * Brand header row — name + logo side by side.
 */
export const brandHeader = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: alias.spacing.m,
});

/**
 * Brand text group (name + reward summary).
 */
export const brandInfo = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    flex: 1,
    minWidth: 0,
});

export const brandLink = style({
    color: "inherit",
    textDecoration: "none",
    selectors: {
        "&:hover, &:active": {
            color: "inherit",
            opacity: 0.7,
        },
        "&:visited": {
            color: "inherit",
        },
    },
});

export const brandLinkIcon = style({
    display: "inline-block",
    verticalAlign: ".05em",
    marginLeft: 4,
});

/**
 * Brand logo — circular image.
 */
export const brandLogo = style({
    width: 48,
    height: 48,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
});

/**
 * Body content area.
 */
export const description = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: alias.spacing.xs,
});

/**
 * Description text with "read more" truncation.
 */
export const descriptionText = style({
    display: "-webkit-box",
    WebkitLineClamp: 5,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
});

/**
 * Info row value — icon + text.
 */
export const infoValue = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    flexShrink: 0,
});
