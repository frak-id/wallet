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

// Single title pinned in the toolbar band, overlaying the sticky header so it
// never moves vertically. `useScrollMorphTitle` only shrinks its font-size /
// font-weight from scroll progress (page title 3xl/bold → toolbar m/semiBold),
// an in-place collapse with no travel — so the size change can't desync from a
// moving position. Fixed height + flex centering keep the single line's center
// fixed as the font shrinks; right padding permanently clears the sort button.
export const title = style({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    margin: 0,
    display: "flex",
    alignItems: "center",
    lineHeight: 1,
    paddingRight: `calc(44px + ${alias.spacing.m})`,
    // Resting (big) start point; mirrors <Title size="page"> (fontSize 3xl / bold).
    fontSize: fontSize["3xl"],
    fontWeight: brand.typography.fontWeight.bold,
    color: vars.text.primary,
    overflow: "hidden",
    // Sits above the blur but never intercepts taps (button re-enables its own).
    zIndex: 1,
    pointerEvents: "none",
});

// Inner text: ellipsizes a longer localized title. Its own element (rather than
// the flex h1) because text-overflow doesn't apply to an anonymous flex item;
// min-width:0 lets it shrink below content width inside the flex row.
export const titleText = style({
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});
