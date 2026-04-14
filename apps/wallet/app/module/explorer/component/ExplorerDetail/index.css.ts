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
 */
export const heroSlide = style({
    flex: "0 0 100%",
    scrollSnapAlign: "start",
    scrollSnapStop: "always",
    width: "100%",
    height: "100%",
});

/**
 * Hero image — cover the hero area, centered.
 */
export const heroImage = style({
    width: "100%",
    objectFit: "cover",
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
});

/**
 * Body content area.
 */
export const bodyContent = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    margin: 0,
    paddingBottom: 0,
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
    WebkitLineClamp: 4,
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
