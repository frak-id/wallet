import { alias, safeArea, zIndex } from "@frak-labs/design-system/tokens";
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

// Collapsed title that crossfades into the button row (iOS large-title
// collapse); hidden until `smallTitleVisible`. Typography comes from the DS
// <Text> body variant — this only positions and fades it.
export const smallTitle = style({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    display: "flex",
    alignItems: "center",
    // Clear the trailing button so a longer localized title ellipsizes instead
    // of running under it.
    paddingRight: `calc(44px + ${alias.spacing.m})`,
    opacity: 0,
    transition: "opacity 0.2s ease",
    pointerEvents: "none",
    zIndex: 1,
});

// Lets the nested <Text> shrink and ellipsize inside the flex row.
export const smallTitleText = style({
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
});

export const smallTitleVisible = style({
    opacity: 1,
});
