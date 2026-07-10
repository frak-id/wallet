import { vars } from "@frak-labs/design-system/theme";
import {
    alias,
    brand,
    fontSize,
    safeArea,
    zIndex,
} from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

// `pointer-events: none` lets touches in the empty part of the row fall through
// to the cards; the button re-enables its own.
export const stickyHeader = style({
    position: "sticky",
    top: 0,
    zIndex: zIndex.sticky,
    pointerEvents: "none",
});

// iOS "scroll edge effect": negative insets bleed to the scroller edges and up
// behind the status bar; height covers the safe area + button row + a feather,
// kept above the title so it stays sharp at rest.
export const scrollBlur = style({
    position: "absolute",
    top: `calc(-1 * (${safeArea.top} + ${alias.spacing.m}))`,
    left: `calc(-1 * ${alias.spacing.m})`,
    right: `calc(-1 * ${alias.spacing.m})`,
    // safe area + content gap + button row + feather.
    height: `calc(${safeArea.top} + ${alias.spacing.m} + 44px + 12px)`,
    zIndex: 0,
    pointerEvents: "none",
});

// Single large title that morphs into the collapsed toolbar title (iOS
// large-title collapse). At rest it sits in flow at page-title size; `sticky`
// pins it into the button row as you scroll, and `titleCollapsed` shrinks it
// there. Fixed height keeps the box stable so the font-size transition never
// reflows the list below it.
//
// Shares `zIndex.sticky` with `stickyHeader` and must stay *after* it in the
// JSX so the collapsed title paints over the header's blur (paint order is
// DOM order at equal z-index) while clearing the trailing sort button via
// `titleCollapsed`'s right padding.
export const title = style({
    position: "sticky",
    top: 0,
    zIndex: zIndex.sticky,
    margin: 0,
    // Fixed height + matching line-height vertically centers the single line in
    // both states (block layout, not flex, so text-overflow ellipsis applies to
    // a longer localized title).
    height: 44,
    lineHeight: "44px",
    // Resting typography mirrors <Title size="page"> (fontSize 3xl / bold).
    fontSize: fontSize["3xl"],
    fontWeight: brand.typography.fontWeight.bold,
    color: vars.text.primary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    // Empty trailing space falls through to the cards; the title never needs taps.
    pointerEvents: "none",
    transition:
        "font-size 0.25s ease, font-weight 0.25s ease, padding-right 0.25s ease",
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            transition: "none",
        },
    },
});

// Collapsed end state: body-sized toolbar title, matching the previous small
// title (fontSize m / semiBold). Right padding clears the sort button so a
// longer localized title ellipsizes instead of running under it.
export const titleCollapsed = style({
    fontSize: fontSize.m,
    fontWeight: brand.typography.fontWeight.semiBold,
    paddingRight: `calc(44px + ${alias.spacing.m})`,
});

// Anchors the collapse sentinel to the top of the scrolling content.
export const listWrapper = style({
    position: "relative",
});

// 1px marker at the content's top (a zero-area target can be skipped by the
// IntersectionObserver on some engines). The observer watches it rather than
// the tall list, which never fully leaves the viewport; absolute so it adds no
// layout gap.
export const collapseSentinel = style({
    position: "absolute",
    top: 0,
    left: 0,
    height: 1,
    width: 1,
    pointerEvents: "none",
});
