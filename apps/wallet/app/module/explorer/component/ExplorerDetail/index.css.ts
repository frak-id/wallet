import { vars } from "@frak-labs/design-system/theme";
import { alias, glass, safeArea } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const heroOverlap = 25;
const heroBadgeBottom = `calc(${alias.spacing.m} + ${heroOverlap}px)`;
// Matches the GlassButton / GlassCloseButton diameter; the toolbar band height
// and the centered title's side clearance are both derived from it so they
// can't drift if the button size changes.
const toolbarButtonSize = 44;

export const heroImageSheet = style({
    marginBottom: `-${heroOverlap}px`,
});

/**
 * iOS "scroll edge effect" behind the fixed toolbar — a progressive backdrop
 * blur that feathers from a heavy top edge downward (same look as the Explorer
 * list). Bleeds up behind the status bar and out to both edges; sits under the
 * buttons / title (zIndex 0) and never intercepts taps. Height = safe-area
 * band + button row + feather.
 */
// Feather the blur out toward the bottom edge: full effect down to 45%, then
// fade to none. Concentrates the frost at the top (behind the status bar),
// mirroring the progressive ScrollEdgeBlur without needing stacked layers.
const toolbarBlurMask =
    "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)";

export const toolbarBlur = style({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: `calc(max(${alias.spacing.m}, ${safeArea.top}) + ${toolbarButtonSize}px + 12px)`,
    zIndex: 0,
    pointerEvents: "none",
    maskImage: toolbarBlurMask,
    WebkitMaskImage: toolbarBlurMask,
    // Animate the blur *radius* (not opacity): WebKit snaps opacity transitions
    // on backdrop-filter elements, but transitions the radius smoothly. Hidden
    // at blur(0) over the resting hero photo; fades in once content scrolls
    // under the toolbar. Unprefixed only — Lightning CSS adds the -webkit- pair
    // (declaring both would collapse it to -webkit- only, killing web blur).
    backdropFilter: "blur(0px)",
    transition: "backdrop-filter 0.28s ease-out",
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            transition: "none",
        },
    },
});

export const toolbarBlurVisible = style({
    backdropFilter: "blur(16px)",
});

/**
 * Centered toolbar title — the merchant name mirrored into the fixed actions
 * band, hidden until the large in-body name scrolls under it. Absolutely
 * centered (rather than a third flex slot) so it stays optically centered
 * regardless of whether the trailing share button is present, and padded on
 * both sides to clear the 44px glass buttons so a long name ellipsizes between
 * them instead of sliding under one.
 */
export const toolbarTitle = style({
    position: "absolute",
    left: 0,
    right: 0,
    // Mirrors DetailSheetActions' own padding-top
    // (max(spacing.m, safe-area-inset-top) in detailSheet.css.ts) so the title
    // sits on the button row; kept in sync manually — update both together.
    top: `max(${alias.spacing.m}, ${safeArea.top})`,
    height: toolbarButtonSize,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: `calc(${toolbarButtonSize}px + ${alias.spacing.l})`,
    paddingRight: `calc(${toolbarButtonSize}px + ${alias.spacing.l})`,
    margin: 0,
    opacity: 0,
    // Slide up a few px while fading in — a subtle iOS-style toolbar title
    // reveal, kept in sync with the scroll-edge blur.
    transform: "translateY(6px)",
    transition: "opacity 0.28s ease-out, transform 0.28s ease-out",
    pointerEvents: "none",
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            transform: "none",
            transition: "none",
        },
    },
});

export const toolbarTitleVisible = style({
    opacity: 1,
    transform: "translateY(0)",
});

/**
 * Inner text: ellipsizes a longer merchant name. Its own element because
 * `text-overflow` doesn't apply to an anonymous flex item; `min-width: 0`
 * lets it shrink below content width inside the centered flex row.
 */
export const toolbarTitleText = style({
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
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
 * Individual slide — fills the carousel viewport. The hero image inside
 * uses `object-fit: cover` so it fills the whole 232 px area, cropping
 * top/bottom as needed without any blurred background fill.
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
 * Hero image — fills the slide using `object-fit: cover` so the image
 * keeps its aspect ratio while covering the whole hero area (cropping
 * top/bottom when needed). No blurred background is rendered behind it.
 */
export const heroImage = style({
    position: "relative",
    zIndex: 1,
    width: "100%",
    height: "100%",
    objectFit: "cover",
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
    zIndex: 1,
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
    paddingBottom: `calc(96px + ${safeArea.bottom})`,
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
    backgroundColor: glass.fill,
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

/**
 * "Starting on" badge shown above the reward card for upcoming campaigns.
 */
export const startingBadge = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    alignSelf: "flex-start",
});

/**
 * Tiered reward block — recipient header stacked above the tier rows. Padding
 * is applied via Box sprinkles to match the InfoRow rows it sits beside.
 */
export const tierBlock = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});
