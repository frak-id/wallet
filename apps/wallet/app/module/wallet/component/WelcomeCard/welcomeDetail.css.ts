import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

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
