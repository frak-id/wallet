import { vars } from "@frak-labs/design-system/theme";
import { alias, zIndex } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Fixed overlay — breaks out of AppShell to cover entire viewport.
 * Uses modal z-index to sit above the bottom tab bar.
 */
export const overlay = style({
    position: "fixed",
    inset: 0,
    zIndex: zIndex.modal,
    backgroundColor: vars.surface.background,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
});

/**
 * Hero image — cover the hero area, centered.
 */
export const heroImage = style({
    width: "100%",
    height: "100%",
    objectFit: "cover",
});

/**
 * Content
 */
export const sectionContent = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

/**
 * Step list — vertical flex with consistent gap.
 */
export const stepList = style({
    display: "flex",
    flexDirection: "column",
});

/**
 * Individual step row — icon circle + text.
 */
export const stepRow = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: alias.spacing.m,
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
});

/**
 * Step text group — title + description stacked.
 */
export const stepText = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    flex: 1,
});

/**
 * Legal text at bottom of body — smaller, muted.
 */
export const legalText = style({
    marginTop: alias.spacing.l,
    textAlign: "center",
});
